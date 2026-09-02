import { ProductRoute } from "@/features/security-console/ProductRoute";

export default async function ActiveScannerPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug = [] } = await params;
  return <ProductRoute area="active-scanner" segments={slug} />;
}

