import { supabase } from "@/lib/supabase";

const currentYear = parseInt(process.env.NEXT_PUBLIC_COMPETITION_YEAR || "2026", 10);

/**
 * Fast student team lookup with case-insensitive fallback.
 * 1. Try server-side .contains() (exact case) — instant
 * 2. Fallback: fetch current year teams only, match client-side
 */
async function findStudentTeam(email: string, selectCols: string) {
  // 1. Fast path — exact case, current year
  const { data: currentExact } = await supabase
    .from("teams")
    .select(selectCols)
    .eq("competition_year", currentYear)
    .contains("teamMembers", JSON.stringify([{ studentEmail: email }]))
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
      if (members.some((m: any) => m.studentEmail && m.studentEmail.toLowerCase() === email.toLowerCase())) {
        return team;
      }
    }
  }

  // 3. Exact case, any year (for past history etc.)
  const { data: anyYearExact } = await supabase
    .from("teams")
    .select(selectCols)
    .contains("teamMembers", JSON.stringify([{ studentEmail: email }]))
    .order("competition_year", { ascending: false })
    .limit(1);

  if (anyYearExact && anyYearExact.length > 0) return anyYearExact[0];

  return null;
}

export async function getAuthenticatedUser() {
  const { data: user, error } = await supabase.auth.getUser();

  if (error || !user?.user?.email) {
    return null;
  }

  return user.user.email;
}

export async function getUserTeam(email: string) {
  // 1️⃣ First, check if the user is a TEACHER (get latest year) - Use ilike for case-insensitive
  const { data: teacherTeams } = await supabase
    .from("teams")
    .select("teamName, competition_year")
    .ilike("teacherEmail", email.trim())
    .order("competition_year", { ascending: false });

  if (teacherTeams && teacherTeams.length > 0) {
    return teacherTeams[0].teamName;
  }

  // 2️⃣ Check if the user is a TEAM MEMBER — fast with fallback
  const team = await findStudentTeam(email, "teamName, competition_year, teamMembers");
  return team ? team.teamName : null;
}

export async function fetchUserTeamData(setUserEmail: any, setTeamName: any, setUserName: any, setCategory?: any) {
  const { data: user, error } = await supabase.auth.getUser();

  if (error || !user?.user?.email) {
    return;
  }

  const email = user.user.email;
  setUserEmail(email);

  // Check if user is a teacher - get latest year - Use ilike for case-insensitive
  const { data: teacherTeams, error: teacherError } = await supabase
    .from("teams")
    .select("teamName, teacherEmail, teacherName, teamMembers, category, competition_year")
    .ilike("teacherEmail", email.trim())
    .order("competition_year", { ascending: false });

  if (!teacherError && teacherTeams && teacherTeams.length > 0) {
    const latestTeam = teacherTeams[0];
    setTeamName(latestTeam.teamName);
    setUserName(latestTeam.teacherName);
    if (setCategory) setCategory(latestTeam.category || "N/A");
    return;
  }

  // Check if user is a student — fast with fallback
  const team = await findStudentTeam(email, "teamName, teacherEmail, teacherName, teamMembers, category, competition_year");
  if (team) {
    const members = team.teamMembers || [];
    const foundMember = members.find(
      (member: any) => member.studentEmail && member.studentEmail.toLowerCase() === email.toLowerCase()
    );
    if (foundMember) {
      setTeamName(team.teamName);
      setUserName(foundMember.name);
      if (setCategory) setCategory(team.category || "N/A");
    }
  }
}

export async function getUserProfile(email: string) {
  // Check if user is a teacher - get latest year only - Use ilike for case-insensitive
  const { data: teacherTeams, error: teacherError } = await supabase
    .from("teams")
    .select("*")
    .ilike("teacherEmail", email.trim())
    .order("competition_year", { ascending: false });

  if (teacherTeams && teacherTeams.length > 0) {
    const teacherTeam = teacherTeams[0]; // Get latest year
    return {
      fullName: teacherTeam.teacherName || "N/A",
      email: email,
      icNumber: teacherTeam.teacherIC || null,
      mobile: teacherTeam.teacherPhone || null,
      gender: teacherTeam.teacherGender || null,
      race: teacherTeam.teacherRace || null,
      tshirtSize: teacherTeam.size || null,
      schoolName: teacherTeam.schoolName || null,
      state: teacherTeam.state || null,
      district: teacherTeam.city || null,
      postcode: teacherTeam.postalCode || null,
      isTeacher: true,
      teamName: teacherTeam.teamName,
      teamId: teacherTeam.id,
      category: teacherTeam.category || null,
      // Student-only fields
      grade: null,
      codingExperience: null,
      parentName: null,
      parentMobile: null,
    };
  }

  // Check if user is a student — fast with fallback
  const team = await findStudentTeam(email, "*");
  if (!team) return null;

  if (team.teamMembers && Array.isArray(team.teamMembers)) {
    const foundMember = team.teamMembers.find(
      (member: any) => member.studentEmail && member.studentEmail.toLowerCase() === email.toLowerCase()
    );

    if (foundMember) {
      return {
        fullName: foundMember.name || "N/A",
        email: email,
        icNumber: foundMember.ic || null,
        gender: foundMember.gender || null,
        race: foundMember.race || null,
        grade: foundMember.grade || null,
        codingExperience: foundMember.codingExperience || null,
        tshirtSize: foundMember.size || null,
        parentName: foundMember.parentName || null,
        parentMobile: foundMember.parentPhone || null,
        schoolName: team.schoolName || null,
        state: team.state || null,
        district: team.city || null,
        postcode: team.postalCode || null,
        isTeacher: false,
        teamName: team.teamName,
        teamId: team.id,
        category: team.category || null,
        // Teacher-only field
        mobile: null,
      };
    }
  }

  return null;
}
