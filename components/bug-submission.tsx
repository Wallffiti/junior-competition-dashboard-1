"use client";

import type React from "react";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { getUserTeamDetails } from "@/lib/teamHelpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { Icons } from "@/components/ui/icons";

export function BugSubmission({ bugNumber }: { bugNumber: number }) {
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [method, setMethod] = useState("");
  const [activeGrouping, setActiveGrouping] = useState<string | null>(null);
  const [is4Submission, setIs4Submission] = useState(false);
  const [bugDetails, setBugDetails] = useState<{
    description: string;
    expectedDescription: string;
    expectedBehaviorImg: string[];
    bugImageImg: string[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [teamDetails, setTeamDetails] = useState<{
    teamId: string;
    teamName: string;
    authorName: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();

  const STORAGE_BASE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`;
  const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB in bytes
  const MAX_FILES = 4;


  useEffect(() => {
    const fetchData = async () => {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user?.user?.email) {
        console.warn("⚠️ No authenticated user found.");
        toast({
          title: "Error",
          description: "User not authenticated.",
          variant: "destructive",
        });
        return;
      }

      const teamData = await getUserTeamDetails(user.user.email);
      if (!teamData) {
        console.warn("No team data found.");
        toast({
          title: "Error",
          description: "Team data not found.",
          variant: "destructive",
        });
        return;
      }
      setTeamDetails(teamData);

      // Get user's category dynamically
      const userCategory = teamData.category || "Junior-Scratch";

      const { data: teamGroupings, error: groupingError } = await supabase
        .from("teamGroupings")
        .select("grouping")
        .eq("teamName", teamData.teamName);

      if (groupingError || !teamGroupings || teamGroupings.length === 0) {
        console.warn("No groupings found for team:", groupingError?.message);
        toast({
          title: "Error",
          description: "No groupings found for team.",
          variant: "destructive",
        });
        return;
      }

      const groupingNames = teamGroupings.map((g) => g.grouping);
      const { data: activeGroupings, error: statusError } = await supabase
        .from("groupingStatus")
        .select("grouping, is4Submission")
        .in("grouping", groupingNames)
        .eq("status", "active");

      if (statusError || !activeGroupings || activeGroupings.length === 0) {
        console.warn("No active groupings found:", statusError?.message);
        toast({
          title: "Error",
          description: "No active grouping found.",
          variant: "destructive",
        });
        return;
      }

      const activeGroup = activeGroupings[0]?.grouping || null;
      setActiveGrouping(activeGroup);
      setIs4Submission(activeGroupings[0]?.is4Submission || false);

      if (!activeGroup) return;

      const { data: stageData, error: stageError } = await supabase
        .from("stages")
        .select("stageId")
        .eq("stageName", activeGroup)
        .single();

      if (stageError || !stageData) {
        console.warn("Stage not found for grouping:", activeGroup, stageError?.message);
        toast({
          title: "Error",
          description: "Stage not found.",
          variant: "destructive",
        });
        return;
      }

      const stageId = stageData.stageId;

      const { data: bugData, error: bugError } = await supabase
        .from("bugs")
        .select("description, expectedDescription, expectedBehaviorImg, bugImageImg")
        .eq("stageId", stageId)
        .eq("bugNumber", bugNumber)
        .eq("category", userCategory)
        .single();

      if (bugError || !bugData) {
        console.warn("Bug not found for category:", userCategory, bugError?.message);
        toast({
          title: "Error",
          description: `Bug not found for your category (${userCategory}).`,
          variant: "destructive",
        });
        return;
      }

      setBugDetails({
        description: bugData.description,
        expectedDescription: bugData.expectedDescription,
        expectedBehaviorImg: bugData.expectedBehaviorImg.map((path: string) => `${STORAGE_BASE_URL}${path}`),
        bugImageImg: bugData.bugImageImg.map((path: string) => `${STORAGE_BASE_URL}${path}`),
      });
    };

    fetchData();
  }, [bugNumber, toast]);

  const resetForm = () => {
    setScreenshots([]);
    setMethod("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (formRef.current) formRef.current.reset();
  };

  const validateFiles = (files: File[]): boolean => {
    if (files.length > MAX_FILES) {
      toast({
        title: "Validation Error",
        description: `Maximum of ${MAX_FILES} images allowed.`,
        variant: "destructive",
      });
      return false;
    }

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "Validation Error",
          description: `${file.name} exceeds 3MB limit.`,
          variant: "destructive",
        });
        return false;
      }
    }
    return true;
  };

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (validateFiles(files)) {
      setScreenshots((prevScreenshots) => {
        const newScreenshots = [...prevScreenshots, ...files];
        if (newScreenshots.length > MAX_FILES) {
          toast({
            title: "Validation Error",
            description: `Maximum of ${MAX_FILES} images allowed.`,
            variant: "destructive",
          });
          return prevScreenshots;
        }
        return newScreenshots;
      });
    } else {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeScreenshot = (index: number) => {
    setScreenshots((prevScreenshots) => prevScreenshots.filter((_, i) => i !== index));
  };

  const uploadScreenshots = async () => {
    if (!teamDetails) return null;
    const uploadedUrls: string[] = [];

    for (const file of screenshots) {
      const filePath = `bugs/${teamDetails.teamId}/${bugNumber}/${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from("bugScreenshots")
        .upload(filePath, file);

      if (error) {
        toast({
          title: "Upload Error",
          description: `Failed to upload ${file.name}.`,
          variant: "destructive",
        });
        return null;
      }

      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/bugScreenshots/${filePath}`;
      uploadedUrls.push(url);
    }

    return uploadedUrls;
  };

  const checkGroupingStatus = async () => {
    if (!teamDetails) return false;

    const { data: teamGroupings, error: groupingError } = await supabase
      .from("teamGroupings")
      .select("grouping")
      .eq("teamName", teamDetails.teamName);

    if (groupingError || !teamGroupings || teamGroupings.length === 0) {
      console.warn("No groupings found for team:", groupingError?.message);
      return false;
    }

    const groupingNames = teamGroupings.map((g) => g.grouping);
    const { data: activeGroupings, error: statusError } = await supabase
      .from("groupingStatus")
      .select("grouping")
      .in("grouping", groupingNames)
      .eq("status", "active");

    if (statusError || !activeGroupings || activeGroupings.length === 0) {
      console.warn("No active groupings found:", statusError?.message);
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
        
    if (!validateFiles(screenshots)) {
      return;
    }
    
    setIsLoading(true);

    const isGroupingActive = await checkGroupingStatus();
    if (!isGroupingActive) {
      toast({
        title: "Submission Blocked",
        description: "The grouping is no longer active. Reloading the page...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      return;
    }

    if (!teamDetails) {
      toast({
        title: "Submission Failed",
        description: "No team information found.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      const screenshotUrls = await uploadScreenshots();
      if (!screenshotUrls) {
        throw new Error("Screenshot upload failed.");
      }

      const { error } = await supabase.from("bugSubmissions").insert([
        {
          teamId: teamDetails.teamId,
          authorName: teamDetails.authorName,
          bugNumber,
          screenshots: screenshotUrls,
          description: method,
          stage: activeGrouping,
          createdAt: new Date().toISOString(),
          penalty: is4Submission, // Set penalty based on is4Submission
        },
      ]);

      if (error) {
        throw error;
      }

      toast({
        title: "Submission Successful",
        description: "Your bug fix has been submitted for review.",
      });

      resetForm();
    } catch (error: any) {
      toast({
        title: "Submission Failed",
        description: error.message || "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Bug #{bugNumber} Description</CardTitle>
          <CardDescription>Review the bug details before submitting your fix</CardDescription>
        </CardHeader>
        <CardContent>
          {bugDetails ? (
            <div className="space-y-4">
              <div>
                {bugDetails.description
                  .replace(/\\n/g, "\n")
                  .split("\n")
                  .map((line, index) => (
                    <p key={index} className="mb-2">{line}</p>
                  ))}
              </div>
              <div className="space-y-2">
                <p className="font-medium">Bug Screenshot(s):</p>
                {bugDetails.bugImageImg.map((imgSrc, index) => (
                  <Image
                    key={index}
                    src={imgSrc}
                    alt={`Bug ${bugNumber} screenshot ${index + 1}`}
                    width={400}
                    height={300}
                    className="rounded-md"
                  />
                ))}
              </div>
              <div className="space-y-2">
                <div>
                  {bugDetails.expectedDescription
                    .replace(/\\n/g, "\n")
                    .split("\n")
                    .map((line, index) => (
                      <p key={index} className="mb-2">{line}</p>
                    ))}
                </div>
                <p className="font-medium">Expected Behavior:</p>
                {bugDetails.expectedBehaviorImg.map((imgSrc, index) => (
                  <Image
                    key={index}
                    src={imgSrc}
                    alt={`Expected behavior screenshot ${index + 1}`}
                    width={400}
                    height={300}
                    className="rounded-md"
                  />
                ))}
              </div>
            </div>
          ) : (
            <p>Loading bug details...</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Submit Your Fix</CardTitle>
          <CardDescription>Upload your code and describe your method</CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="screenshot">Code Screenshot(s)</Label>
              <Input
                id="screenshot"
                type="file"
                accept="image/*"
                onChange={handleScreenshotChange}
                ref={fileInputRef}
                multiple
                required
              />
              <p className="text-sm text-gray-500">
                Maximum 4 images, each up to 3MB
              </p>
              {screenshots.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm text-gray-500">Selected files:</p>
                  <ul className="list-disc pl-5">
                    {screenshots.map((file, index) => (
                      <li key={index} className="text-sm flex items-center justify-between">
                        <span>{file.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeScreenshot(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="method">Fix Method Description</Label>
              <Textarea
                id="method"
                placeholder="Describe how you fixed the bug..."
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                required
              />
            </div>
            <div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Icons.spinner className="mr-2 h-4 w-4 animate-spin" /> : "Submit Fix"}
              </Button>
              {is4Submission && (
                <p className="text-sm text-yellow-600 mt-2">
                  You are still able to submit bug fix, but there will be a penalty.
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}