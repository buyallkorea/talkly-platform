import MessageCenter from "@/components/messages/MessageCenter";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <MessageCenter key={id} role="admin" threadId={id} />; }
