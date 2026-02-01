import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function BugsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Bugs</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(5)].map((_, i) => (
          <Link key={i} href={`/dashboard/submission/bugs/${i + 1}`}>
            <Button variant="outline" className="w-full">
              Bug #{i + 1}
            </Button>
          </Link>
        ))}
      </div>
    </div>
  )
}

