"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"

export default function DebugPage() {
  const [authEmail, setAuthEmail] = useState<string | null>(null)
  const [teacherResults, setTeacherResults] = useState<any>(null)
  const [studentResults, setStudentResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const runDebug = async () => {
    setLoading(true)
    
    // Get auth email
    const { data: user } = await supabase.auth.getUser()
    const email = user?.user?.email || null
    setAuthEmail(email)

    if (!email) {
      setLoading(false)
      return
    }

    // Test teacher query with .eq (case-sensitive)
    const { data: teacherEq } = await supabase
      .from("teams")
      .select("teamName, teacherEmail, category")
      .eq("teacherEmail", email)
    
    // Test teacher query with .ilike (case-insensitive)
    const { data: teacherIlike } = await supabase
      .from("teams")
      .select("teamName, teacherEmail, category")
      .ilike("teacherEmail", email)

    setTeacherResults({
      withEq: teacherEq || [],
      withIlike: teacherIlike || []
    })

    // Test student query
    const { data: studentData } = await supabase
      .from("teams")
      .select("teamName, teamMembers, category")
      .contains("teamMembers", JSON.stringify([{ studentEmail: email }]))

    setStudentResults(studentData || [])
    
    setLoading(false)
  }

  useEffect(() => {
    runDebug()
  }, [])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Debug: Email Matching</h1>
      
      <Button onClick={runDebug} disabled={loading} className="mb-6">
        {loading ? "Running..." : "Run Debug"}
      </Button>

      <div className="space-y-6">
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-bold mb-2">Auth Email:</h2>
          <p className="font-mono text-sm">{authEmail || "Not logged in"}</p>
          <p className="text-xs text-gray-600 mt-1">
            Length: {authEmail?.length || 0} | 
            Has spaces: {authEmail?.includes(" ") ? "YES" : "NO"}
          </p>
        </div>

        <div className="bg-blue-50 p-4 rounded">
          <h2 className="font-bold mb-2">Teacher Query Results:</h2>
          
          <div className="mb-4">
            <h3 className="font-semibold text-sm text-gray-700">Using .eq() (case-sensitive):</h3>
            <pre className="text-xs bg-white p-2 rounded mt-1 overflow-auto">
              {JSON.stringify(teacherResults?.withEq, null, 2)}
            </pre>
          </div>

          <div>
            <h3 className="font-semibold text-sm text-gray-700">Using .ilike() (case-insensitive):</h3>
            <pre className="text-xs bg-white p-2 rounded mt-1 overflow-auto">
              {JSON.stringify(teacherResults?.withIlike, null, 2)}
            </pre>
          </div>
        </div>

        <div className="bg-green-50 p-4 rounded">
          <h2 className="font-bold mb-2">Student Query Results:</h2>
          <pre className="text-xs bg-white p-2 rounded mt-1 overflow-auto">
            {JSON.stringify(studentResults, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}
