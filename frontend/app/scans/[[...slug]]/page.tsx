import { ProductRoute } from "@/features/security-console/ProductRoute";

export default async function ScansPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug = [] } = await params;
  return <ProductRoute area="scans" segments={slug} />;
}

