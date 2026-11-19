import Survey from "../components/Survey";
import { USER_IDS } from "../lib/users";



// Build sırasında her kullanıcı için ayrı bir sayfa üretir
export function generateStaticParams() {
  return USER_IDS.map((userId) => ({ userId }));
}

export default function UserPage({ params }) {
  return <Survey userId={params.userId} />;
}
