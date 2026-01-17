"use client"

import React, { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { getUserTeamDetails } from "@/lib/teamHelpers"
import { useToast } from "@/hooks/use-toast"
import { BlockNoteRenderer } from "@/components/blocknote-renderer"

const Page = () => {
  const [missionPackContent, setMissionPackContent] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const fetchMissionPackContent = async () => {
      try {
        setIsLoading(true)

        // Step 1: Get user and team details
        const { data: user, error: userError } = await supabase.auth.getUser()
        if (userError || !user?.user?.email) {
          throw new Error("User not authenticated.")
        }

        const teamData = await getUserTeamDetails(user.user.email)
        if (!teamData) {
          throw new Error("Team data not found.")
        }

        // Step 2: Fetch active grouping
        const { data: teamGroupings, error: groupingError } = await supabase
          .from("teamGroupings")
          .select("grouping")
          .eq("teamName", teamData.teamName)

        if (groupingError || !teamGroupings || teamGroupings.length === 0) {
          throw new Error("No groupings found for team.")
        }

        const groupingNames = teamGroupings.map((g) => g.grouping)
        const { data: activeGroupings, error: statusError } = await supabase
          .from("groupingStatus")
          .select("grouping")
          .in("grouping", groupingNames)
          .eq("status", "active")

        if (statusError || !activeGroupings || activeGroupings.length === 0) {
          throw new Error("No active grouping found.")
        }

        const activeGroup = activeGroupings[0]?.grouping || null
        if (!activeGroup) {
          throw new Error("Active grouping is null.")
        }

        // Step 3: Fetch stageId from stages table
        const { data: stageData, error: stageError } = await supabase
          .from("stages")
          .select("stageId")
          .eq("stageName", activeGroup)
          .single()

        if (stageError || !stageData) {
          throw new Error("Stage not found for grouping: " + activeGroup)
        }

        const stageId = stageData.stageId
        const stageIdStr = String(stageId)

        // Get user's category dynamically
        const userCategory = teamData.category || "Junior-Scratch"

        // Step 4: Fetch mission pack content from missionPacks table with category filter
        const { data: missionPackData, error: missionPackError } = await supabase
          .from("missionPacks")
          .select("content")
          .eq("stageId", stageIdStr)
          .eq("category", userCategory)
          .single()

        if (missionPackError || !missionPackData) {
          // Fallback: Try to fetch mission pack for user's category without stageId filter
          const { data: fallbackData, error: fallbackError } = await supabase
            .from("missionPacks")
            .select("content")
            .eq("category", userCategory)
            .single()

          if (fallbackError || !fallbackData) {
            throw new Error(
              "Mission pack not found. Original error: " +
              missionPackError?.message +
              ". Fallback error: " +
              fallbackError?.message
            )
          }

          setMissionPackContent(fallbackData.content)
          return
        }

        setMissionPackContent(missionPackData.content)
      } catch (error: any) {
        console.error("Error fetching mission pack:", error.message)
        toast({
          title: "Error",
          description: error.message || "Failed to load mission pack.",
          variant: "destructive",
        })
        setMissionPackContent(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchMissionPackContent()
  }, [toast])

  if (isLoading) {
    return <p>Loading mission pack...</p>
  }

  if (!missionPackContent) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p>No mission pack available for the current stage.</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Mission Pack</h1>
      <BlockNoteRenderer content={missionPackContent} className="mb-8" />
    </div>
  )
}

export default Page