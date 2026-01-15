import { supabase } from "@/lib/supabase";

export async function getTeamGroupings(teamName: string) {
  const { data: teamGroupings, error } = await supabase
    .from("teamGroupings")
    .select("grouping")
    .eq("teamName", teamName);

  if (error || !teamGroupings || teamGroupings.length === 0) {
    return [];
  }

  const groupNames = teamGroupings.map(g => g.grouping);
  return groupNames; // Return an array of group names
}

export async function isAnyGroupingActive(teamGroupings: string[]) {
  const { data: activeGroupings, error } = await supabase
    .from("groupingStatus")
    .select("grouping")
    .eq("status", "active");

  if (error || !activeGroupings || activeGroupings.length === 0) {
    return false;
  }

  const activeGroupingNames = activeGroupings.map(g => g.grouping);

  // Check if ANY of the user's groupings match an active grouping
  const isAllowed = teamGroupings.some(group => activeGroupingNames.includes(group));

  if (isAllowed) {
    return true;
  } else {
    return false;
  }
}
