import { requireChatGPTUser } from "./chatgpt-auth";import BuildEstimateApp from "@/components/buildestimate-app";
export const dynamic="force-dynamic";
export default async function Home(){const user=await requireChatGPTUser("/");return <BuildEstimateApp user={{name:user.displayName,email:user.email}}/>}
