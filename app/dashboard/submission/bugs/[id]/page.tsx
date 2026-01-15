import { BugSubmission } from "@/components/bug-submission"

export default async function BugPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const bugNumber = Number.parseInt(id, 10)

  if (isNaN(bugNumber) || bugNumber <= 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Invalid Bug ID</h1>
        <p className="text-red-600">The bug ID must be a valid positive number.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Bug #{bugNumber}</h1>
      <BugSubmission bugNumber={bugNumber} />
    </div>
  )
}

