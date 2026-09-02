import { ProductRoute } from "@/features/security-console/ProductRoute";

export default async function AiAnalystPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug = [] } = await params;
  return <ProductRoute area="ai-analyst" segments={slug} />;
}

