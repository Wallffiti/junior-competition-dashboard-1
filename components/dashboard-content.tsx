"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { getUserTeamDetails } from "@/lib/teamHelpers"
import { useToast } from "@/hooks/use-toast"
import { BlockNoteRenderer } from "@/components/blocknote-renderer"

// Helper function to detect if content is BlockNote JSON format
const isBlockNoteContent = (content: string): boolean => {
  try {
    const parsed = JSON.parse(content)
    return Array.isArray(parsed) && parsed.every((block: any) => block.type && typeof block.type === "string")
  } catch {
    return false
  }
}

export function DashboardContent() {
  const [updates, setUpdates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const fetchUpdates = async () => {
      // 1. Get current user
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user?.user?.email) {
        console.warn("⚠️ No authenticated user found.")
        toast({
          title: "Error",
          description: "User not authenticated.",
          variant: "destructive",
        })
        return
      }

      // 2. Get user's team details
      const teamData = await getUserTeamDetails(user.user.email)
      if (!teamData) {
        console.warn("No team data found.")
        toast({
          title: "Error",
          description: "Team data not found.",
          variant: "destructive",
        })
        return
      }

      // 3. Get all team groupings
      const { data: teamGroupings, error: groupingError } = await supabase
        .from("teamGroupings")
        .select("grouping")
        .eq("teamName", teamData.teamName)

      if (groupingError || !teamGroupings || teamGroupings.length === 0) {
        console.warn("No groupings found for team:", groupingError?.message)
        toast({
          title: "Error",
          description: "No groupings found for team.",
          variant: "destructive",
        })
        return
      }

      const groupingNames = teamGroupings.map((g) => g.grouping)

      // 4. Get stages for all groupings
      const { data: stageData, error: stageError } = await supabase
        .from("stages")
        .select("stageId, stageName")
        .in("stageName", groupingNames)

      if (stageError || !stageData || stageData.length === 0) {
        console.warn("Stages not found for groupings:", stageError?.message)
        toast({
          title: "Error",
          description: "Stages not found.",
          variant: "destructive",
        })
        return
      }

      const stageIds = stageData.map((stage) => stage.stageId)

      // Use user's actual category instead of hardcoded Junior-Scratch
      const userCategory = teamData.category || "Junior-Scratch"
      const currentYear = new Date().getFullYear().toString()

      const { data: updatesData, error: updatesError } = await supabase
        .from("update")
        .select("stageId, content, description, category, announcement_date")
        .in("stageId", stageIds)
        .eq("category", userCategory)
        .eq("competition_year", currentYear)
        .eq("is_archived", false)
        .order("announcement_date", { ascending: false })

      if (updatesError || !updatesData) {
        console.warn("Updates not found:", updatesError?.message)
        toast({
          title: "Error",
          description: "No updates found.",
          variant: "destructive",
        })
        return
      }

      // 6. Map stageIds back to stageNames for display
      const updatesWithStageNames = updatesData.map((update) => ({
        ...update,
        stageName:
          stageData.find((stage) => stage.stageId === update.stageId)?.stageName || "Unknown",
      }))

      setUpdates(updatesWithStageNames)
      setLoading(false)
    }

    fetchUpdates()
  }, [toast])

  if (loading) {
    return <div>Loading updates...</div>
  }

  return (
    <div className="grid gap-6">
      {updates.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">No Updates</CardTitle>
          </CardHeader>
          <CardContent>
            <p>No updates available for your team at this time.</p>
          </CardContent>
        </Card>
      ) : (
        updates.map((update, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="text-xl font-semibold">{update.description}</CardTitle>
            </CardHeader>
            <CardContent>
              {isBlockNoteContent(update.content) ? (
                <BlockNoteRenderer content={update.content} />
              ) : (
                <div dangerouslySetInnerHTML={{ __html: update.content }} />
              )}
            </CardContent>
          </Card>
        ))
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Need Help?</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            <a
              href="https://wa.me/60132208130"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              Contact support via WhatsApp
            </a>
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            If you have any questions, our support team is here to help.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}