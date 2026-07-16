import { NextResponse } from "next/server";
import { z } from "zod";
import {
  inferCategoryColor,
  inferCategoryIcon,
  inferCategoryPaletteKey,
} from "@/lib/category-style";
import { authenticatedHousehold } from "@/lib/server-auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().trim().min(1).max(60),
  categoryGroup: z.string().trim().min(1).max(40),
});

export async function POST(request: Request) {
  const auth = await authenticatedHousehold();
  if (!auth)
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  const body = schema.safeParse(await request.json());
  if (!body.success)
    return NextResponse.json(
      { message: "Enter a category name and group." },
      { status: 400 },
    );
  const supabase = await createClient();
  const { data: group } = await supabase
    .from("category_groups")
    .select("name")
    .eq("household_id", auth.householdId)
    .eq("name", body.data.categoryGroup)
    .maybeSingle();
  if (!group)
    return NextResponse.json(
      { message: "Choose an existing category group." },
      { status: 400 },
    );
  const excluded = body.data.categoryGroup === "Excluded";
  const behaviorType = excluded
    ? "excluded"
    : body.data.categoryGroup === "Income"
      ? "income"
      : body.data.categoryGroup === "Goals"
        ? "goal"
        : "spending";
  const { data, error } = await supabase
    .from("categories")
    .insert({
      household_id: auth.householdId,
      name: body.data.name,
      color: inferCategoryColor(body.data.name),
      icon: inferCategoryIcon(body.data.name),
      palette_key: inferCategoryPaletteKey(body.data.name),
      category_group: body.data.categoryGroup,
      behavior_type: behaviorType,
      is_active: true,
      is_excluded: excluded,
      show_in_budget: !excluded && body.data.categoryGroup !== "Income",
      sort_order: 500,
    })
    .select(
      "id,name,color,icon,palette_key,category_group,behavior_type,is_active,is_excluded,show_in_budget",
    )
    .single();
  if (error || !data)
    return NextResponse.json(
      {
        message:
          error?.code === "23505"
            ? "That category already exists."
            : "Category could not be added.",
      },
      { status: error?.code === "23505" ? 409 : 500 },
    );
  await supabase
    .from("audit_events")
    .insert({
      household_id: auth.householdId,
      actor_user_id: auth.userId,
      entity_type: "category",
      entity_id: data.id,
      action: "created",
      metadata: { name: data.name, categoryGroup: data.category_group },
    });
  return NextResponse.json({
    message: "Category added.",
    category: {
      id: data.id,
      name: data.name,
      color: data.color,
      icon: data.icon,
      paletteKey: data.palette_key,
      categoryGroup: data.category_group,
      behaviorType: data.behavior_type,
      isActive: data.is_active,
      isExcluded: data.is_excluded,
      showInBudget: data.show_in_budget,
      budgetedCents: 0,
      spentCents: 0,
      pendingCents: 0,
      recentTransactions: [],
    },
  });
}
