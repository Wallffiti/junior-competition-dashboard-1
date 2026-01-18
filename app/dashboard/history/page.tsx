"use client";


import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { getUserTeamDetails } from "@/lib/teamHelpers";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Eye, Trash2 } from "lucide-react";
import { SubmissionDetailsModal } from "@/components/submission-details-modal";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

type Submission = {
  id: string;
  type: string;
  submittedBy: string;
  submissionDate: string;
  tableName: string;
  bugNumber?: number;
  stage?: string | null;
  details: any;
};

export default function HistoryPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [submissionToDelete, setSubmissionToDelete] = useState<Submission | null>(null);
  const [isArchived, setIsArchived] = useState(false);
  const { toast } = useToast();

  const storageBaseUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public`;

  // Function to convert UTC to Kuala Lumpur time
  const convertToKLTime = (utcDate: string) => {
    const date = new Date(utcDate);
    return date.toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" });
  };

  useEffect(() => {
    const fetchSubmissions = async () => {
      const { data: user, error } = await supabase.auth.getUser();
      if (error || !user?.user?.email) return;

      const teamData = await getUserTeamDetails(user.user.email);
      if (!teamData) return;

      const teamId = teamData.teamId;

      // Check if team is archived
      const { data: teamInfo, error: teamInfoError } = await supabase
        .from("teams")
        .select("is_archived")
        .eq("id", teamId)
        .single();

      if (teamInfo?.is_archived === true) {
        setIsArchived(true);
        return;
      }

      // Fetch submissions from all tables, including the stage field
      const [bugRes, enhancementRes, brainstormRes, presentationRes, projectRes] = await Promise.all([
        supabase.from("bugSubmissions").select("*").eq("teamId", teamId),
        supabase.from("enhancements").select("*").eq("teamId", teamId),
        supabase.from("brainstormMaps").select("*").eq("teamId", teamId),
        supabase.from("presentations").select("*").eq("teamId", teamId),
        supabase.from("projects").select("*").eq("teamId", teamId),
      ]);

      const getFullPath = (path: string) => {
        if (path.startsWith("https://")) {
          return encodeURI(path);
        }
        return `${storageBaseUrl}/${encodeURIComponent(path)}`;
      };

      const formattedSubmissions: Submission[] = [
        ...(bugRes.data?.map((b) => ({
          id: b.id,
          type: `Bug #${b.bugNumber}`,
          tableName: "bugSubmissions",
          submittedBy: b.authorName,
          submissionDate: convertToKLTime(b.serverTime),
          stage: b.stage,
          details: {
            ...b,
            screenshots: b.screenshots?.map(getFullPath) || [],
          },
        })) || []),
        ...(enhancementRes.data?.map((e) => ({
          id: e.id,
          type: e.enhancementType === "advanced" ? "Advanced Enhancement" : "Medium Enhancement",
          tableName: "enhancements",
          submittedBy: e.authorName,
          submissionDate: convertToKLTime(e.serverTime),
          stage: e.stage,
          details: {
            ...e,
            screenshots: e.screenshots?.map(getFullPath) || [],
          },
        })) || []),
        ...(brainstormRes.data?.map((bm) => ({
          id: bm.id,
          type: "Brainstorm Map",
          tableName: "brainstormMaps",
          submittedBy: bm.authorName,
          submissionDate: convertToKLTime(bm.serverTime),
          stage: bm.stage,
          details: {
            ...bm,
            fileUrl: getFullPath(bm.fileUrl),
          },
        })) || []),
        ...(presentationRes.data?.map((p) => ({
          id: p.id,
          type: "Presentation",
          tableName: "presentations",
          submittedBy: p.authorName,
          submissionDate: convertToKLTime(p.serverTime),
          stage: p.stage,
          details: p,
        })) || []),
        ...(projectRes.data?.map((pr) => ({
          id: pr.id,
          type: "Project",
          tableName: "projects",
          submittedBy: pr.authorName,
          submissionDate: convertToKLTime(pr.serverTime),
          stage: pr.stage,
          details: pr,
        })) || []),
      ];

      // Sort submissions by stage (alphabetically), then type (alphabetically), then submissionDate (most recent first)
      const sortedSubmissions = formattedSubmissions.sort((a, b) => {
        // Handle null/undefined stages by treating them as "N/A" for sorting
        const stageA = a.stage || "N/A";
        const stageB = b.stage || "N/A";

        // Compare stages first (alphabetically)
        const stageComparison = stageA.localeCompare(stageB);
        if (stageComparison !== 0) return stageComparison;

        // If stages are the same, compare types (alphabetically)
        const typeComparison = a.type.localeCompare(b.type);
        if (typeComparison !== 0) return typeComparison;

        // If types are the same, sort by submissionDate (most recent first)
        return new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime();
      });

      setSubmissions(sortedSubmissions);
    };

    fetchSubmissions();
  }, []);

  const filteredSubmissions = useMemo(() => {
    if (typeFilter === "all") return submissions;
    return submissions.filter((submission) => submission.type === typeFilter);
  }, [typeFilter, submissions]);

  const confirmDeleteSubmission = (submission: Submission) => {
    setSubmissionToDelete(submission);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!submissionToDelete) return;

    try {
      // Delete from Supabase
      await supabase.from(submissionToDelete.tableName).delete().eq("id", submissionToDelete.id);

      // Remove from UI
      setSubmissions((prev) => prev.filter((s) => s.id !== submissionToDelete.id));

      toast({
        title: "Submission Deleted",
        description: "The submission has been removed successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete submission. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setSubmissionToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Submission History</h1>

      {isArchived ? (
        <p>This team has been archived. Please register for a new team to participate.</p>
      ) : (
        <>
          <Table>
        <TableCaption>A list of your recent submissions</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Stage</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Submitted By</TableHead>
            <TableHead>Submission Date</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredSubmissions.map((submission) => (
            <TableRow key={submission.id}>
              <TableCell>{submission.stage || "N/A"}</TableCell>
              <TableCell>{submission.type}</TableCell>
              <TableCell>{submission.submittedBy}</TableCell>
              <TableCell>{submission.submissionDate}</TableCell>
              <TableCell>
                <div className="flex space-x-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-blue-500 hover:text-blue-600"
                    onClick={() => {
                      setSelectedSubmission(submission);
                      setIsModalOpen(true);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500 hover:text-red-600"
                    onClick={() => confirmDeleteSubmission(submission)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <SubmissionDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        submission={selectedSubmission}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <p>Are you sure you want to delete this submission? This action cannot be undone.</p>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </>
      )}
    </div>
  );
}