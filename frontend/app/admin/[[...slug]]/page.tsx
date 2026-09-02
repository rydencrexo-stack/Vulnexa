import { ProductRoute } from "@/features/security-console/ProductRoute";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug = [] } = await params;
  return <ProductRoute area="admin" segments={slug} />;
}

