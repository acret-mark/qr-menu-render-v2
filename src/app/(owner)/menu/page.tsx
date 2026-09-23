import { auth } from "@/lib/auth/auth.config";
import { getMenuForOwner } from "@/lib/items/queries";
import { MenuItemList } from "@/components/items/menu-item-list";
import { AddItemFab } from "@/components/items/add-item-fab";

export default async function MenuPage() {
  const session = await auth();
  // The (owner) layout already guarantees a signed-in user with a valid
  // business row before this page renders.
  const { categories, items } = await getMenuForOwner(session!.user!.id);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-xl font-semibold">Menu Items</h1>
      <MenuItemList categories={categories} items={items} />
      <AddItemFab />
    </div>
  );
}
