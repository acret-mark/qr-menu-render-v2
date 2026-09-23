import { auth } from "@/lib/auth/auth.config";
import { getCategoriesForOwner } from "@/lib/categories/queries";
import { CategoryList } from "@/components/categories/category-list";
import { AddCategoryFab } from "@/components/categories/add-category-fab";

export default async function CategoriesPage() {
  const session = await auth();
  // The (owner) layout already guarantees a signed-in user with a valid
  // business row before this page renders.
  const categories = await getCategoriesForOwner(session!.user!.id);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-xl font-semibold">Categories</h1>
      <CategoryList categories={categories} />
      <AddCategoryFab />
    </div>
  );
}
