"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getUserProfile } from "@/lib/authHelpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Mail, User, CreditCard, Phone, Users, School, MapPin, Hash, Edit, Loader2, X, FileEdit } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

interface UserProfile {
  fullName: string;
  email: string;
  icNumber: string | null;
  mobile: string | null;
  gender: string | null;
  race: string | null;
  grade: string | null;
  codingExperience: string | null;
  tshirtSize: string | null;
  parentName: string | null;
  parentMobile: string | null;
  schoolName: string | null;
  state: string | null;
  district: string | null;
  postcode: string | null;
  isTeacher: boolean;
  teamName: string;
  teamId: string;
  category: string | null;
}

interface ChangeRequest {
  id: string;
  status: string;
  requested_at: string;
  reviewed_at: string | null;
  admin_notes: string | null;
  requested_data: any;
  original_data: any;
  approved_fields: any;
}

const ProfileField = ({ icon: Icon, label, value }: { icon: any; label: string; value: string | null }) => (
  <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
    <Icon className="h-5 w-5 text-gray-600 mt-0.5" />
    <div className="flex-1">
      <p className="text-sm font-medium text-gray-600">{label}</p>
      <p className="text-base font-semibold text-gray-900">
        {value || "Not provided"}
      </p>
    </div>
  </div>
);

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [showChangeDialog, setShowChangeDialog] = useState(false);
  const [editedData, setEditedData] = useState<any>({});
  const [requestReason, setRequestReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchUserProfile = async () => {
      setIsLoading(true);
      
      try {
        // Get authenticated user
        const { data: user, error: userError } = await supabase.auth.getUser();
        if (userError || !user?.user?.email) {
          console.error("Error fetching user:", userError);
          return;
        }

        const profileData = await getUserProfile(user.user.email);
        setProfile(profileData);

        // Fetch existing change requests
        if (profileData) {
          await fetchChangeRequests(profileData.teamId, profileData.icNumber);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, []);

  const fetchChangeRequests = async (teamId: string, personIdentifier: string | null) => {
    try {
      const { data, error } = await supabase
        .from("team_change_requests")
        .select("*")
        .eq("team_id", teamId)
        .eq("person_identifier", personIdentifier || "")
        .order("requested_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      setChangeRequests(data || []);
    } catch (error) {
      console.error("Error fetching change requests:", error);
    }
  };

  const openChangeRequestDialog = () => {
    if (!profile) return;

    // Pre-populate edited data with current profile
    const currentData: any = {
      name: profile.fullName,
      email: profile.email,
      ic: profile.icNumber,
      gender: profile.gender,
      race: profile.race,
      size: profile.tshirtSize,
    };

    if (profile.isTeacher) {
      currentData.phone = profile.mobile;
      currentData.schoolName = profile.schoolName;
    } else {
      currentData.grade = profile.grade;
      currentData.codingExperience = profile.codingExperience;
      currentData.parentName = profile.parentName;
      currentData.parentPhone = profile.parentMobile;
      currentData.studentEmail = profile.email;
      currentData.schoolName = profile.schoolName;
    }

    setEditedData(currentData);
    setRequestReason("");
    setShowChangeDialog(true);
  };

  const handleFieldChange = (field: string, value: string) => {
    setEditedData((prev: any) => ({
      ...prev,
      [field]: value,
    }));
  };

  const submitChangeRequest = async () => {
    if (!profile) return;

    // Check if there are any changes
    const hasChanges = Object.keys(editedData).some((key) => {
      const currentValue = profile.isTeacher
        ? key === "name"
          ? profile.fullName
          : key === "phone"
          ? profile.mobile
          : key === "ic"
          ? profile.icNumber
          : (profile as any)[key]
        : key === "name"
        ? profile.fullName
        : key === "ic"
        ? profile.icNumber
        : key === "parentPhone"
        ? profile.parentMobile
        : key === "size"
        ? profile.tshirtSize
        : (profile as any)[key];

      return editedData[key] !== currentValue;
    });

    if (!hasChanges) {
      toast({
        title: "No Changes",
        description: "You haven't made any changes to your profile.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      // Build original data
      const originalData: any = {
        name: profile.fullName,
        email: profile.email,
        ic: profile.icNumber,
        gender: profile.gender,
        race: profile.race,
        size: profile.tshirtSize,
      };

      if (profile.isTeacher) {
        originalData.phone = profile.mobile;
        originalData.schoolName = profile.schoolName;
      } else {
        originalData.grade = profile.grade;
        originalData.codingExperience = profile.codingExperience;
        originalData.parentName = profile.parentName;
        originalData.parentPhone = profile.parentMobile;
        originalData.studentEmail = profile.email;
        originalData.schoolName = profile.schoolName;
      }

      const { error } = await supabase.from("team_change_requests").insert({
        team_id: profile.teamId,
        team_name: profile.teamName,
        category: profile.category,
        requester_email: profile.email,
        person_type: profile.isTeacher ? "teacher" : "student",
        person_identifier: profile.icNumber,
        person_name: profile.fullName,
        original_data: originalData,
        requested_data: editedData,
        status: "pending",
        request_reason: requestReason || null,
        competition_year: new Date().getFullYear().toString(),
      });

      if (error) throw error;

      toast({
        title: "Request Submitted",
        description: "Your change request has been submitted for admin review.",
      });

      setShowChangeDialog(false);
      await fetchChangeRequests(profile.teamId, profile.icNumber);
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to submit request: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const cancelChangeRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from("team_change_requests")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) throw error;

      toast({
        title: "Request Cancelled",
        description: "Your change request has been cancelled.",
      });

      if (profile) {
        await fetchChangeRequests(profile.teamId, profile.icNumber);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to cancel request: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: { variant: "secondary", label: "Pending" },
      approved: { variant: "default", label: "Approved" },
      rejected: { variant: "destructive", label: "Rejected" },
      cancelled: { variant: "outline", label: "Cancelled" },
    };

    const config = variants[status] || variants.pending;
    return (
      <Badge variant={config.variant as any}>{config.label}</Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-MY", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 px-4 lg:px-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <Skeleton className="h-8 w-32" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center space-x-4">
              <Skeleton className="h-20 w-20 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto py-6 px-4 lg:px-8">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="py-10">
            <p className="text-center text-gray-600">No profile data found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 lg:px-8">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold">Profile</CardTitle>
            <Button onClick={openChangeRequestDialog}>
              <Edit className="h-4 w-4 mr-2" />
              Request Change
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Profile Header */}
          <div className="flex items-center space-x-4 pb-6 border-b">
            <Avatar className="h-20 w-20">
              <AvatarImage src="/avatars/01.png" alt={profile.fullName} />
              <AvatarFallback className="text-2xl">
                {profile.fullName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-2xl font-semibold">{profile.fullName}</h2>
              <p className="text-sm text-gray-500">
                {profile.isTeacher ? "Teacher" : "Student"} • {profile.teamName}
              </p>
            </div>
          </div>

          {/* Change Requests Section */}
          {changeRequests.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-800">Recent Change Requests</h3>
              <div className="space-y-3">
                {changeRequests.map((request) => (
                  <Alert key={request.id}>
                    <FileEdit className="h-4 w-4" />
                    <AlertTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>Change Request</span>
                        {getStatusBadge(request.status)}
                      </div>
                      {request.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => cancelChangeRequest(request.id)}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                      )}
                    </AlertTitle>
                    <AlertDescription>
                      <p className="text-sm text-gray-600">
                        Requested on {formatDate(request.requested_at)}
                      </p>
                      {request.status === "approved" && request.reviewed_at && (
                        <>
                          <p className="text-sm text-green-600 mt-1">
                            Approved on {formatDate(request.reviewed_at)}
                          </p>
                          {/* Show which fields were approved */}
                          <div className="mt-3 space-y-2">
                            <p className="text-xs font-semibold text-gray-700">Field Status:</p>
                            {Object.keys(request.requested_data).map((field) => {
                              const wasApproved = request.approved_fields?.hasOwnProperty(field);
                              const oldValue = request.original_data[field];
                              const newValue = request.requested_data[field];
                              
                              // Only show if there was a change
                              if (JSON.stringify(oldValue) === JSON.stringify(newValue)) return null;
                              
                              return (
                                <div key={field} className={`text-xs p-2 rounded ${wasApproved ? 'bg-green-100' : 'bg-gray-100'}`}>
                                  <div className="flex items-center gap-2">
                                    {wasApproved ? (
                                      <Badge variant="default" className="text-xs">Approved</Badge>
                                    ) : (
                                      <Badge variant="secondary" className="text-xs">Not Approved</Badge>
                                    )}
                                    <span className="font-medium">
                                      {field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                    </span>
                                  </div>
                                  {wasApproved && (
                                    <p className="text-gray-600 mt-1">
                                      Changed to: <span className="font-semibold">{newValue || 'N/A'}</span>
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                      {request.status === "rejected" && request.admin_notes && (
                        <p className="text-sm text-red-600 mt-1">
                          Rejection reason: {request.admin_notes}
                        </p>
                      )}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </div>
          )}

          {/* Personal Information */}
          <div>
            <h3 className="text-lg font-semibold mb-3 text-gray-800">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ProfileField icon={User} label="Full Name" value={profile.fullName} />
              <ProfileField icon={Mail} label="Email Address" value={profile.email} />
              <ProfileField icon={CreditCard} label="IC Number" value={profile.icNumber} />
              <ProfileField icon={User} label="Gender" value={profile.gender} />
              <ProfileField icon={User} label="Race" value={profile.race} />
              <ProfileField icon={User} label="T-shirt Size" value={profile.tshirtSize} />
              {profile.isTeacher && (
                <ProfileField icon={Phone} label="Mobile" value={profile.mobile} />
              )}
            </div>
          </div>

          {/* Student-Specific Information */}
          {!profile.isTeacher && (
            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-800">Student Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <ProfileField icon={User} label="Grade" value={profile.grade} />
                <ProfileField icon={User} label="Coding Experience" value={profile.codingExperience} />
                <ProfileField icon={Users} label="Parent Name" value={profile.parentName} />
                <ProfileField icon={Phone} label="Parent Mobile" value={profile.parentMobile} />
              </div>
            </div>
          )}

          {/* School Information */}
          <div>
            <h3 className="text-lg font-semibold mb-3 text-gray-800">School Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ProfileField icon={School} label="School Name" value={profile.schoolName} />
              <ProfileField icon={MapPin} label="State" value={profile.state} />
              <ProfileField icon={MapPin} label="City" value={profile.district} />
              <ProfileField icon={Hash} label="Postcode" value={profile.postcode} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Request Dialog */}
      <Dialog open={showChangeDialog} onOpenChange={setShowChangeDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request Profile Change</DialogTitle>
            <DialogDescription>
              Edit the fields you want to change. Only modified fields will be submitted for review.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Personal Information */}
            <div>
              <h3 className="font-semibold mb-3">Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={editedData.name || ""}
                    onChange={(e) => handleFieldChange("name", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={editedData.email || ""}
                    onChange={(e) => handleFieldChange("email", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="ic">IC Number</Label>
                  <Input
                    id="ic"
                    value={editedData.ic || ""}
                    onChange={(e) => handleFieldChange("ic", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="gender">Gender</Label>
                  <Select
                    value={editedData.gender || ""}
                    onValueChange={(value) => handleFieldChange("gender", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="race">Race</Label>
                  <Input
                    id="race"
                    value={editedData.race || ""}
                    onChange={(e) => handleFieldChange("race", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="size">T-shirt Size</Label>
                  <Select
                    value={editedData.size || ""}
                    onValueChange={(value) => handleFieldChange("size", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="xs">XS</SelectItem>
                      <SelectItem value="s">S</SelectItem>
                      <SelectItem value="m">M</SelectItem>
                      <SelectItem value="l">L</SelectItem>
                      <SelectItem value="xl">XL</SelectItem>
                      <SelectItem value="2xl">2XL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Teacher-specific fields */}
            {profile?.isTeacher && (
              <div>
                <h3 className="font-semibold mb-3">Teacher Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="phone">Mobile Phone</Label>
                    <Input
                      id="phone"
                      value={editedData.phone || ""}
                      onChange={(e) => handleFieldChange("phone", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="schoolName">School Name</Label>
                    <Input
                      id="schoolName"
                      value={editedData.schoolName || ""}
                      onChange={(e) => handleFieldChange("schoolName", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Student-specific fields */}
            {profile && !profile.isTeacher && (
              <div>
                <h3 className="font-semibold mb-3">Student Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="grade">Grade</Label>
                    <Input
                      id="grade"
                      value={editedData.grade || ""}
                      onChange={(e) => handleFieldChange("grade", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="codingExperience">Coding Experience</Label>
                    <Input
                      id="codingExperience"
                      value={editedData.codingExperience || ""}
                      onChange={(e) => handleFieldChange("codingExperience", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="parentName">Parent Name</Label>
                    <Input
                      id="parentName"
                      value={editedData.parentName || ""}
                      onChange={(e) => handleFieldChange("parentName", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="parentPhone">Parent Mobile</Label>
                    <Input
                      id="parentPhone"
                      value={editedData.parentPhone || ""}
                      onChange={(e) => handleFieldChange("parentPhone", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="schoolName">School Name</Label>
                    <Input
                      id="schoolName"
                      value={editedData.schoolName || ""}
                      onChange={(e) => handleFieldChange("schoolName", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Request Reason */}
            <div>
              <Label htmlFor="reason">Reason for Change (Optional)</Label>
              <Textarea
                id="reason"
                placeholder="Explain why you need to change this information..."
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChangeDialog(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submitChangeRequest} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Request"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
