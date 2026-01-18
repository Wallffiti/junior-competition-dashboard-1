import { supabase } from "@/lib/supabase";

export async function getAuthenticatedUser() {
  const { data: user, error } = await supabase.auth.getUser();

  if (error || !user?.user?.email) {
    return null;
  }

  return user.user.email;
}

export async function getUserTeam(email: string) {
  // 1️⃣ First, check if the user is a TEACHER (get latest year)
  const { data: teacherTeams } = await supabase
    .from("teams")
    .select("teamName, competition_year")
    .eq("teacherEmail", email)
    .order("competition_year", { ascending: false });

  if (teacherTeams && teacherTeams.length > 0) {
    return teacherTeams[0].teamName;
  }

  // 2️⃣ Check if the user is a TEAM MEMBER (student email inside JSONB, get latest year)
  const { data: studentTeams } = await supabase
    .from("teams")
    .select("teamName, competition_year")
    .contains("teamMembers", JSON.stringify([{ studentEmail: email }]))
    .order("competition_year", { ascending: false});

  if (studentTeams && studentTeams.length > 0) {
    return studentTeams[0].teamName;
  }

  return null;
}

export async function fetchUserTeamData(setUserEmail: any, setTeamName: any, setUserName: any, setCategory?: any) {
  const { data: user, error } = await supabase.auth.getUser();

  if (error || !user?.user?.email) {
    return;
  }

  const email = user.user.email;
  setUserEmail(email);

  // Check if user is a teacher - get latest year
  const { data: teacherTeams, error: teacherError } = await supabase
    .from("teams")
    .select("teamName, teacherEmail, teacherName, teamMembers, category, competition_year")
    .eq("teacherEmail", email)
    .order("competition_year", { ascending: false });

  if (!teacherError && teacherTeams && teacherTeams.length > 0) {
    const latestTeam = teacherTeams[0];
    setTeamName(latestTeam.teamName);
    setUserName(latestTeam.teacherName);
    if (setCategory) setCategory(latestTeam.category || "N/A");
    return;
  }

  // Check if user is a student - get latest year
  const { data: studentTeams, error: studentError } = await supabase
    .from("teams")
    .select("teamName, teacherEmail, teacherName, teamMembers, category, competition_year")
    .contains("teamMembers", JSON.stringify([{ studentEmail: email }]))
    .order("competition_year", { ascending: false });

  if (!studentError && studentTeams && studentTeams.length > 0) {
    const latestTeam = studentTeams[0];
    const foundMember = latestTeam.teamMembers.find(
      (member: any) => member.studentEmail === email
    );
    
    if (foundMember) {
      setTeamName(latestTeam.teamName);
      setUserName(foundMember.name);
      if (setCategory) setCategory(latestTeam.category || "N/A");
      return;
    }
  }
}

export async function getUserProfile(email: string) {
  // Check if user is a teacher - get latest year only
  const { data: teacherTeams, error: teacherError } = await supabase
    .from("teams")
    .select("*")
    .eq("teacherEmail", email)
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

  // Check if user is a student - get latest year only
  const { data: studentTeams, error: studentError } = await supabase
    .from("teams")
    .select("*")
    .contains("teamMembers", JSON.stringify([{ studentEmail: email }]))
    .order("competition_year", { ascending: false });

  if (studentError) {
    console.error("Error fetching student teams:", studentError);
    return null;
  }

  if (studentTeams && studentTeams.length > 0) {
    // Use the latest year team
    const team = studentTeams[0];
    
    if (team.teamMembers && Array.isArray(team.teamMembers)) {
      const foundMember = team.teamMembers.find(
        (member: any) => member.studentEmail === email
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
  }

  return null;
}
