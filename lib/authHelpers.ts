import { supabase } from "@/lib/supabase";

export async function getAuthenticatedUser() {
  const { data: user, error } = await supabase.auth.getUser();

  if (error || !user?.user?.email) {
    return null;
  }

  return user.user.email;
}

export async function getUserTeam(email: string) {
  // 1️⃣ First, check if the user is a TEACHER
  const { data: teacherTeam } = await supabase
    .from("teams")
    .select("teamName")
    .eq("teacherEmail", email)
    .maybeSingle();

  if (teacherTeam) {
    return teacherTeam.teamName;
  }

  // 2️⃣ Check if the user is a TEAM MEMBER (student email inside JSONB)
  const { data: studentTeam } = await supabase
    .from("teams")
    .select("teamName")
    .contains("teamMembers", JSON.stringify([{ studentEmail: email }]))
    .maybeSingle();

  if (studentTeam) {
    return studentTeam.teamName;
  }

  return null;
}

export async function fetchUserTeamData(setUserEmail: any, setTeamName: any, setUserName: any) {
  const { data: user, error } = await supabase.auth.getUser();

  if (error || !user?.user?.email) {
    return;
  }

  const email = user.user.email;
  setUserEmail(email);

  const { data: teams, error: teamError } = await supabase
    .from("teams")
    .select("teamName, teacherEmail, teacherName, teamMembers");

  if (teamError) {
    return;
  }

  for (const team of teams) {
    if (team.teacherEmail === email) {
      setTeamName(team.teamName);
      setUserName(team.teacherName);
      return;
    }

    // Check if the user is a team member (by studentEmail)
    const foundMember = team.teamMembers.find(
      (member: any) => member.studentEmail === email
    );
    if (foundMember) {
      setTeamName(team.teamName);
      setUserName(foundMember.name);
      return;
    }
  }
}
