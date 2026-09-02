import { ProductRoute } from "@/features/security-console/ProductRoute";

export default async function FindingsPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug = [] } = await params;
  return <ProductRoute area="findings" segments={slug} />;
}

