"use client"

import React, { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { getUserTeamDetails } from "@/lib/teamHelpers"
import { useToast } from "@/hooks/use-toast"
import { BlockNoteRenderer } from "@/components/blocknote-renderer"

const Page = () => {
  const [missionPackContent, setMissionPackContent] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [debugInfo, setDebugInfo] = useState<any>(null)
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

        console.log("Querying missionPacks with stageId:", stageId, "type:", typeof stageId, "and category: Junior-Scratch")

        // Ensure stageId is a string for comparison
        const stageIdStr = String(stageId)

        // Debug: Fetch all mission packs to see what's available
        const { data: allMissionPacks, error: allError } = await supabase
          .from("missionPacks")
          .select("missionPackId, stageId, category")
        
        console.log("All mission packs available:", allMissionPacks, allError)

        // Store debug info
        const debug = {
          activeGroup,
          stageId,
          stageIdStr,
          allMissionPacks
        }
        setDebugInfo(debug)

        // Step 4: Fetch mission pack content from missionPacks table with category filter
        const { data: missionPackData, error: missionPackError } = await supabase
          .from("missionPacks")
          .select("content")
          .eq("stageId", stageIdStr)
          .eq("category", "Junior-Scratch")
          .single()

        if (missionPackError || !missionPackData) {
          console.error("Error fetching mission pack with stageId:", missionPackError)
          
          // Fallback: Try to fetch Junior-Scratch mission pack without stageId filter
          console.log("Trying fallback query for Junior-Scratch category only...")
          const { data: fallbackData, error: fallbackError } = await supabase
            .from("missionPacks")
            .select("content")
            .eq("category", "Junior-Scratch")
            .single()

          if (fallbackError || !fallbackData) {
            throw new Error(
              "Mission pack not found. Original error: " +
              missionPackError?.message +
              ". Fallback error: " +
              fallbackError?.message
            )
          }

          console.log("Fallback successful! Mission Pack Data:", fallbackData)
          setMissionPackContent(fallbackData.content)
          return
        }

        console.log("Mission Pack Data:", missionPackData)
        console.log("Mission Pack Content:", missionPackData.content)
        console.log("Content Type:", typeof missionPackData.content)

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
        <p>No mission pack available for the current stage in Junior-Scratch category.</p>
        {debugInfo && (
          <div className="mt-6 p-4 bg-gray-100 rounded border border-gray-300">
            <h3 className="font-bold mb-2">Debug Info:</h3>
            <pre className="text-xs overflow-auto max-h-96">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        )}
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