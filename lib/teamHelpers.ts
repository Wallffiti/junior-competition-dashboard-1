import { supabase } from "@/lib/supabase";

/**
 * Fetches team details for a logged-in user.
 */
export const getUserTeamDetails = async (userEmail: string) => {
  // First, check if the user is a teacher
  const { data: teacherTeam, error: teacherError } = await supabase
    .from("teams")
    .select("id, teamName, teacherEmail, teacherName, teamMembers")
    .eq("teacherEmail", userEmail)
    .single();

  if (teacherError && teacherError.code !== "PGRST116") {
    return null;
  }

  if (teacherTeam) {
    return {
      teamId: teacherTeam.id,
      teamName: teacherTeam.teamName,
      authorName: teacherTeam.teacherName, // Use teacher name
    };
  }

  // 🔥 FIXED: Query teamMembers JSONB correctly!
  const { data: studentTeams, error: studentError } = await supabase
    .from("teams")
    .select("id, teamName, teamMembers")
    .filter("teamMembers", "cs", JSON.stringify([{ parentEmail: userEmail }])); // ✅ JSON stringified

  if (studentError) {
    return null;
  }

  if (!studentTeams || studentTeams.length === 0) {
    return null;
  }

  // Find the student in `teamMembers`
  const team = studentTeams[0];
  const foundMember = team.teamMembers.find((member: any) => member.parentEmail === userEmail);
  
  if (!foundMember) {
    return null;
  }

  return {
    teamId: team.id,
    teamName: team.teamName,
    authorName: foundMember.name, // Use student name
  };
};
