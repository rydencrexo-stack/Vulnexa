import { ProductRoute } from "@/features/security-console/ProductRoute";

export default async function ReconPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug = [] } = await params;
  return <ProductRoute area="recon" segments={slug} />;
}

