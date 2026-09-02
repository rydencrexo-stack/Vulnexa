import { ProductRoute } from "@/features/security-console/ProductRoute";

export default async function LearningPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug = [] } = await params;
  return <ProductRoute area="learning" segments={slug} />;
}

