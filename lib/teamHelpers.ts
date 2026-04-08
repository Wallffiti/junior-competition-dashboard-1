import { supabase } from "@/lib/supabase";

/**
 * Fetches team details for a logged-in user.
 */
export const getUserTeamDetails = async (userEmail: string) => {
  // First, check if the user is a teacher - Use ilike for case-insensitive comparison
  const { data: teacherTeam, error: teacherError } = await supabase
    .from("teams")
    .select("id, teamName, teacherEmail, teacherName, teamMembers, category, competition_year")
    .ilike("teacherEmail", userEmail.trim())
    .order("competition_year", { ascending: false });

  if (teacherError && teacherError.code !== "PGRST116") {
    return null;
  }

  if (teacherTeam && teacherTeam.length > 0) {
    // Use the team with the latest competition_year
    const latestTeam = teacherTeam[0];
    return {
      teamId: latestTeam.id,
      teamName: latestTeam.teamName,
      authorName: latestTeam.teacherName, // Use teacher name
      category: latestTeam.category, // Add category
    };
  }

  // 🔥 FIXED: Query teamMembers JSONB correctly!
  const { data: studentTeams, error: studentError } = await supabase
    .from("teams")
    .select("id, teamName, teamMembers, category, competition_year")
    .contains("teamMembers", JSON.stringify([{ studentEmail: userEmail }]))
    .order("competition_year", { ascending: false });

  if (studentError) {
    return null;
  }

  if (!studentTeams || studentTeams.length === 0) {
    return null;
  }

  // Find the student in `teamMembers` - use latest year
  const team = studentTeams[0];
  const foundMember = team.teamMembers.find((member: any) => member.studentEmail === userEmail);
  
  if (!foundMember) {
    return null;
  }

  return {
    teamId: team.id,
    teamName: team.teamName,
    authorName: foundMember.name, // Use student name
    category: team.category, // Add category
  };
};
