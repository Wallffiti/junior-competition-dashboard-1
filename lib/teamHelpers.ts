import { supabase } from "@/lib/supabase";

const currentYear = parseInt(process.env.NEXT_PUBLIC_COMPETITION_YEAR || "2026", 10);

/**
 * Case-insensitive student team lookup.
 * Fast path: server-side .contains() (exact case).
 * Fallback: fetch current year teams only and match client-side.
 */
async function findStudentTeam(userEmail: string, selectCols: string) {
  // 1. Fast path — exact case, current year
  const { data: currentExact } = await supabase
    .from("teams")
    .select(selectCols)
    .eq("competition_year", currentYear)
    .contains("teamMembers", JSON.stringify([{ studentEmail: userEmail }]))
    .limit(1);

  if (currentExact && currentExact.length > 0) return currentExact[0];

  // 2. Case-insensitive fallback — current year only (small dataset)
  const { data: yearTeams } = await supabase
    .from("teams")
    .select(selectCols)
    .eq("competition_year", currentYear);

  if (yearTeams) {
    for (const team of yearTeams) {
      const members = team.teamMembers || [];
      if (members.some((m: any) => m.studentEmail && m.studentEmail.toLowerCase() === userEmail.toLowerCase())) {
        return team;
      }
    }
  }

  // 3. Exact case, any year (for past history pages etc.)
  const { data: anyYearExact } = await supabase
    .from("teams")
    .select(selectCols)
    .contains("teamMembers", JSON.stringify([{ studentEmail: userEmail }]))
    .order("competition_year", { ascending: false })
    .limit(1);

  if (anyYearExact && anyYearExact.length > 0) return anyYearExact[0];

  return null;
}

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
    const latestTeam = teacherTeam[0];
    return {
      teamId: latestTeam.id,
      teamName: latestTeam.teamName,
      authorName: latestTeam.teacherName,
      category: latestTeam.category,
    };
  }

  // Student lookup — fast with fallback
  const team = await findStudentTeam(userEmail, "id, teamName, teamMembers, category, competition_year");
  if (!team) return null;

  const foundMember = (team.teamMembers || []).find(
    (m: any) => m.studentEmail && m.studentEmail.toLowerCase() === userEmail.toLowerCase()
  );

  return foundMember
    ? { teamId: team.id, teamName: team.teamName, authorName: foundMember.name, category: team.category }
    : null;
};
