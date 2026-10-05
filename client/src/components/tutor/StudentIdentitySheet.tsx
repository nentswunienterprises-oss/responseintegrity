import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { API_URL } from "@/lib/config";
import { supabase } from "@/lib/supabaseClient";
import { authorizedGetJson } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Save } from "lucide-react";

const PERSONALITY_TYPES = [
  "Afraid to be incorrect",
  "Very shy",
  "Feels underestimated",
  "Reserved, but driven",
  "Reserved",
  "Loves praises",
  "Needs structure",
  "Shy, but smart",
];

const LEARNING_IDS = [
  "Entrepreneur (CEO, Businessman/Woman, Leader)",
  "Lawyer",
  "Accountant",
  "Doctor/Surgeon",
  "Movie director (Storyteller)",
  "COO (Manager, Builder for casual)",
  "Coach",
  "Teacher",
  "Engineer",
];

const GRADES = ["6", "7", "8", "9"];

const CONFIDENCE_TRIGGERS = [
  "Accuracy",
  "Visuals",
  "Genuine Compliment",
  "Celebrating Progress",
];

const CONFIDENCE_KILLERS = [
  "Feeling rushed",
  "Constructive criticism",
  "Repeating same mistakes",
  "Being corrected",
  "Looking dumb",
];

const IDENTITY_SHEET_QUESTIONS = [
  {
    category: "Phase 1 - Orientation",
    questions: [
      "Which math topics usually feel easiest for you?",
      "Which topics tend to confuse you the most?",
      "When a question looks unfamiliar, what usually happens first?",
      "Do you usually rush, freeze, or guess?",
    ],
  },
  {
    category: "Phase 2 - Surface the Pattern",
    questions: [
      "Which math topic never quite made sense?",
      "Are there moments in math where your mind goes blank?",
      "Which type of question usually causes problems?",
    ],
  },
  {
    category: "Phase 3 - Diagnose the Layer",
    questions: [
      "What did you observe when the student attempted unfamiliar problems?",
      "What response pattern showed up during difficulty (rush, freeze, guess, shutdown, etc.)?",
      "What are the two primary problem areas identified in this session?",
    ],
  },
  {
    category: "3-Layer Lens Diagnosis",
    questions: [
      "Vocabulary: Which terms or wording did the student not understand?",
      "Method: Where did the student's process sequence break down?",
      "Reason: What could the student not explain about why the method works?",
    ],
  },
  {
    category: "Intro Session Outcome",
    questions: [
      "Main difficulty topic to prioritize in early sessions",
      "Most unstable learning layer (Vocabulary, Method, or Reason)",
      "How the student responds when confused",
      "Response Integrity working structure agreed for next sessions",
    ],
  },
];

interface StudentIdentitySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  onSaved?: () => void;
  readOnly?: boolean;
  apiBasePath?: string; // e.g., "/api/coo" for COO view, defaults to "/api/tutor"
}

interface FormData {
  // Section 1: Personal Profile
  name: string;
  grade: string;
  school: string;
  learningId: string;
  personalityType: string;
  longTermGoals: string;

  // Section 2: Emotional Insights
  relationshipWithMath: string;
  confidenceTriggers: string[];
  confidenceKillers: string[];
  pressureResponse: string;
  growthDrivers: string;

  // Section 3: Academic Diagnosis
  currentClassTopics: string;
  strugglesWith: string;
  gapsIdentified: string;
  bossBattlesCompleted: string;
  lastBossBattleResult: string;
  tutorNotes: string;

  // Identity Sheet - 4-Part Flow
  identitySheetResponses: Record<string, string[]>;
}

export default function StudentIdentitySheet({
  open,
  onOpenChange,
  studentId,
  studentName,
  onSaved,
  readOnly = false,
  apiBasePath = "/api/tutor",
}: StudentIdentitySheetProps) {
  const [formData, setFormData] = useState<FormData>({
    name: studentName,
    grade: "",
    school: "",
    learningId: "",
    personalityType: "",
    longTermGoals: "",
    relationshipWithMath: "",
    confidenceTriggers: [],
    confidenceKillers: [],
    pressureResponse: "",
    growthDrivers: "",
    currentClassTopics: "",
    strugglesWith: "",
    gapsIdentified: "",
    bossBattlesCompleted: "",
    lastBossBattleResult: "",
    tutorNotes: "",
    identitySheetResponses: {},
  });

  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("personal");
  const [loadedStudentId, setLoadedStudentId] = useState<string | null>(null);
  const [originalData, setOriginalData] = useState<FormData | null>(null);
  const [hasExistingSheet, setHasExistingSheet] = useState(false);

  // Initialize identity sheet responses
  const initializeIdentityResponses = () => {
    const responses: Record<string, string[]> = {};
    IDENTITY_SHEET_QUESTIONS.forEach((section) => {
      section.questions.forEach((q, idx) => {
        responses[`${section.category}-${idx}`] = [""];
      });
    });
    return responses;
  };

  // Load existing identity sheet data when dialog opens or student changes
  useEffect(() => {
    if (open && studentId && loadedStudentId !== studentId) {
      const loadExistingData = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const headers: HeadersInit = {};
          if (session?.access_token) {
            headers.Authorization = `Bearer ${session.access_token}`;
          }
          try {
            console.log(`📋 Loading identity sheet from: ${apiBasePath}/students/${studentId}/identity-sheet`);
            const data = await authorizedGetJson(`${apiBasePath}/students/${studentId}/identity-sheet`);
            console.log("📋 Identity sheet data received:", data);
            
            // Check if there's actual saved data
            const hasData = !!(data.identitySheet || data.personalProfile || data.emotionalInsights || data.academicDiagnosis);
            setHasExistingSheet(hasData);
            
            if (hasData) {
              // Clean up corrupted array data
              const cleanArray = (value: any): string[] => {
                if (!value) return [];
                if (Array.isArray(value)) {
                  // Filter out single-character strings (corrupted data)
                  return value.filter(item => typeof item === 'string' && item.length > 1);
                }
                return [];
              };

              const loadedFormData: FormData = {
                name: data.personalProfile?.name || studentName,
                grade: data.personalProfile?.grade || "",
                school: data.personalProfile?.school || "",
                learningId: data.personalProfile?.learningId || "",
                personalityType: data.personalProfile?.personalityType || "",
                longTermGoals: data.personalProfile?.longTermGoals || "",
                relationshipWithMath: data.emotionalInsights?.relationshipWithMath || "",
                confidenceTriggers: cleanArray(data.emotionalInsights?.confidenceTriggers),
                confidenceKillers: cleanArray(data.emotionalInsights?.confidenceKillers),
                pressureResponse: data.emotionalInsights?.pressureResponse || "",
                growthDrivers: data.emotionalInsights?.growthDrivers || "",
                currentClassTopics: data.academicDiagnosis?.currentClassTopics || "",
                strugglesWith: data.academicDiagnosis?.strugglesWith || "",
                gapsIdentified: data.academicDiagnosis?.gapsIdentified || "",
                bossBattlesCompleted: data.academicDiagnosis?.bossBattlesCompleted || "",
                lastBossBattleResult: data.academicDiagnosis?.lastBossBattleResult || "",
                tutorNotes: data.academicDiagnosis?.tutorNotes || "",
                identitySheetResponses: data.identitySheet || initializeIdentityResponses(),
              };
              
              setFormData(loadedFormData);
              setOriginalData(JSON.parse(JSON.stringify(loadedFormData))); // Deep clone
            } else {
              setOriginalData(null);
            }
          } catch (err) {
            console.error("Failed to load identity sheet:", err);
          }
          setLoadedStudentId(studentId);
        } catch (error) {
          console.error("Error loading identity sheet:", error);
        }
      };
      loadExistingData();
    }
  }, [open, studentId, loadedStudentId, studentName, apiBasePath]);

  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleIdentityResponseChange = (
    category: string,
    index: number,
    value: string
  ) => {
    const key = `${category}-${index}`;
    setFormData((prev) => ({
      ...prev,
      identitySheetResponses: {
        ...prev.identitySheetResponses,
        [key]: [value],
      },
    }));
  };

  // Check if form data has changed from original
  const hasChanges = () => {
    if (!originalData) return true; // New sheet, always has changes
    return JSON.stringify(formData) !== JSON.stringify(originalData);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      console.log("🔵 FRONTEND - About to save formData.confidenceTriggers:", formData.confidenceTriggers);
      console.log("Type:", typeof formData.confidenceTriggers, "IsArray:", Array.isArray(formData.confidenceTriggers));
      console.log("🔵 FRONTEND - About to save formData.confidenceKillers:", formData.confidenceKillers);
      console.log("Type:", typeof formData.confidenceKillers, "IsArray:", Array.isArray(formData.confidenceKillers));
      
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
      
      const response = await fetch(`${API_URL}/api/tutor/students/${studentId}/identity-sheet`, {
        method: "POST",
        headers,
        body: JSON.stringify(formData),
        credentials: "include",
      });

      if (response.ok) {
        setLoadedStudentId(studentId);
        setHasExistingSheet(true);
        setOriginalData(formData); // Update original data to current
        
        // Call onSaved callback and wait for it
        if (onSaved) {
          await onSaved();
        }
        
        // Small delay to ensure state propagates
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Close dialog after state updates
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Error saving identity sheet:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Student Profile & Identity Sheet</DialogTitle>
          <DialogDescription className="text-sm">
            Building a complete profile for {studentName}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto gap-1">
            <TabsTrigger value="personal" className="text-xs sm:text-sm py-2">Personal</TabsTrigger>
            <TabsTrigger value="emotional" className="text-xs sm:text-sm py-2">Emotional</TabsTrigger>
            <TabsTrigger value="academic" className="text-xs sm:text-sm py-2">Academic</TabsTrigger>
            <TabsTrigger value="identity" className="text-xs sm:text-sm py-2">Identity</TabsTrigger>
          </TabsList>

          {/* TAB 1: PERSONAL PROFILE */}
          <TabsContent value="personal" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🔹 Personal Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      placeholder="Student name"
                      readOnly={readOnly}
                    />
                  </div>
                  <div>
                    <Label htmlFor="grade">Grade</Label>
                    <Select
                      value={formData.grade}
                      onValueChange={(value) =>
                        handleInputChange("grade", value)
                      }
                    >
                      <SelectTrigger className={readOnly ? "pointer-events-none" : ""}>
                        <SelectValue placeholder="Select grade" />
                      </SelectTrigger>
                      <SelectContent>
                        {GRADES.map((grade) => (
                          <SelectItem key={grade} value={grade}>
                            Grade {grade}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="school">School</Label>
                    <Input
                      id="school"
                      value={formData.school}
                      onChange={(e) => handleInputChange("school", e.target.value)}
                      placeholder="School name"
                      readOnly={readOnly}
                    />
                  </div>
                  <div>
                    <Label htmlFor="learningId">Learning ID</Label>
                    <Select
                      value={formData.learningId}
                      onValueChange={(value) =>
                        handleInputChange("learningId", value)
                      }
                    >
                      <SelectTrigger className={readOnly ? "pointer-events-none" : ""}>
                        <SelectValue placeholder="Select learning ID" />
                      </SelectTrigger>
                      <SelectContent>
                        {LEARNING_IDS.map((id) => (
                          <SelectItem key={id} value={id}>
                            {id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="personalityType">Personality Type</Label>
                  <Select
                    value={formData.personalityType}
                    onValueChange={(value) =>
                      handleInputChange("personalityType", value)
                    }
                  >
                    <SelectTrigger className={readOnly ? "pointer-events-none" : ""}>
                      <SelectValue placeholder="Select personality type" />
                    </SelectTrigger>
                    <SelectContent>
                      {PERSONALITY_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="longTermGoals">Long-Term Goals</Label>
                  <Textarea
                    id="longTermGoals"
                    value={formData.longTermGoals}
                    onChange={(e) => handleInputChange("longTermGoals", e.target.value)}
                    placeholder="What are this student's long-term aspirations?"
                    rows={4}
                    readOnly={readOnly}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: EMOTIONAL INSIGHTS */}
          <TabsContent value="emotional" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🔹 Emotional Insights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="relationshipWithMath">Relationship With Math</Label>
                  <Textarea
                    id="relationshipWithMath"
                    value={formData.relationshipWithMath}
                    onChange={(e) => handleInputChange("relationshipWithMath", e.target.value)}
                    placeholder="How does this student feel about math?"
                    rows={3}
                    readOnly={readOnly}
                  />
                </div>

                <div>
                  <Label>Confidence Triggers (select all that apply)</Label>
                  <div className="space-y-2 mt-2">
                    {CONFIDENCE_TRIGGERS.map((trigger) => (
                      <div key={trigger} className="flex items-center space-x-2">
                        <Checkbox
                          id={`trigger-${trigger}`}
                          checked={formData.confidenceTriggers.includes(trigger)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              handleInputChange("confidenceTriggers", [...formData.confidenceTriggers, trigger]);
                            } else {
                              handleInputChange("confidenceTriggers", formData.confidenceTriggers.filter(t => t !== trigger));
                            }
                          }}
                          className={readOnly ? "pointer-events-none" : ""}
                        />
                        <label
                          htmlFor={`trigger-${trigger}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {trigger}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Confidence Killers (select all that apply)</Label>
                  <div className="space-y-2 mt-2">
                    {CONFIDENCE_KILLERS.map((killer) => (
                      <div key={killer} className="flex items-center space-x-2">
                        <Checkbox
                          id={`killer-${killer}`}
                          checked={formData.confidenceKillers.includes(killer)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              handleInputChange("confidenceKillers", [...formData.confidenceKillers, killer]);
                            } else {
                              handleInputChange("confidenceKillers", formData.confidenceKillers.filter(k => k !== killer));
                            }
                          }}
                          className={readOnly ? "pointer-events-none" : ""}
                        />
                        <label
                          htmlFor={`killer-${killer}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {killer}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="pressureResponse">Pressure Response</Label>
                  <Textarea
                    id="pressureResponse"
                    value={formData.pressureResponse}
                    onChange={(e) => handleInputChange("pressureResponse", e.target.value)}
                    placeholder="How does this student respond to pressure?"
                    rows={3}
                    readOnly={readOnly}
                  />
                </div>

                <div>
                  <Label htmlFor="growthDrivers">Growth Drivers</Label>
                  <Textarea
                    id="growthDrivers"
                    value={formData.growthDrivers}
                    onChange={(e) => handleInputChange("growthDrivers", e.target.value)}
                    placeholder="What motivates this student to grow?"
                    rows={3}
                    readOnly={readOnly}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: ACADEMIC DIAGNOSIS */}
          <TabsContent value="academic" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🔹 Academic Diagnosis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="currentClassTopics">Current Class Topics</Label>
                  <Textarea
                    id="currentClassTopics"
                    value={formData.currentClassTopics}
                    onChange={(e) => handleInputChange("currentClassTopics", e.target.value)}
                    placeholder="What is the student currently studying?"
                    rows={3}
                    readOnly={readOnly}
                  />
                </div>

                <div>
                  <Label htmlFor="strugglesWith">Struggles With</Label>
                  <Textarea
                    id="strugglesWith"
                    value={formData.strugglesWith}
                    onChange={(e) => handleInputChange("strugglesWith", e.target.value)}
                    placeholder="What specific math concepts are challenging?"
                    rows={3}
                    readOnly={readOnly}
                  />
                </div>

                <div>
                  <Label htmlFor="gapsIdentified">Gaps Identified</Label>
                  <Textarea
                    id="gapsIdentified"
                    value={formData.gapsIdentified}
                    onChange={(e) => handleInputChange("gapsIdentified", e.target.value)}
                    placeholder="What foundational gaps need to be addressed?"
                    rows={3}
                    readOnly={readOnly}
                  />
                </div>

                <div>
                  <Label htmlFor="bossBattlesCompleted">Boss Battles Completed</Label>
                  <Input
                    id="bossBattlesCompleted"
                    value={formData.bossBattlesCompleted}
                    onChange={(e) => handleInputChange("bossBattlesCompleted", e.target.value)}
                    placeholder="e.g., Algebra Fundamentals"
                    readOnly={readOnly}
                  />
                </div>

                <div>
                  <Label htmlFor="lastBossBattleResult">Last Boss Battle Result</Label>
                  <Textarea
                    id="lastBossBattleResult"
                    value={formData.lastBossBattleResult}
                    onChange={(e) => handleInputChange("lastBossBattleResult", e.target.value)}
                    placeholder="How did the student perform?"
                    rows={3}
                    readOnly={readOnly}
                  />
                </div>

                <div>
                  <Label htmlFor="tutorNotes">Specialist Notes</Label>
                  <Textarea
                    id="tutorNotes"
                    value={formData.tutorNotes}
                    onChange={(e) => handleInputChange("tutorNotes", e.target.value)}
                    placeholder="Any additional observations or notes"
                    rows={4}
                    readOnly={readOnly}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: IDENTITY SHEET - INTRO SESSION STRUCTURE */}
          <TabsContent value="identity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Introductory Session
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {IDENTITY_SHEET_QUESTIONS.map((section, sectionIdx) => (
                  <div key={sectionIdx} className="space-y-3 pb-4 border-b last:border-b-0">
                    <h4 className="font-semibold text-sm text-gray-800">
                      {section.category}
                    </h4>
                    {section.questions.map((question, qIdx) => (
                      <div key={qIdx}>
                        <Label className="text-sm text-gray-700 mb-2 block">
                          {question}
                        </Label>
                        <Textarea
                          value={
                            formData.identitySheetResponses[
                              `${section.category}-${qIdx}`
                            ]?.[0] || ""
                          }
                          onChange={(e) =>
                            handleIdentityResponseChange(
                              section.category,
                              qIdx,
                              e.target.value
                            )
                          }
                          placeholder="Student's response..."
                          rows={2}
                          className="text-sm"
                          readOnly={readOnly}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Save Button - only show for editable mode */}
        <div className="flex justify-end gap-2 mt-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly && (
            <Button 
              onClick={handleSave} 
              disabled={isSaving || (hasExistingSheet && !hasChanges())}
            >
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {hasExistingSheet 
                ? (hasChanges() ? "Save Changes" : "No Changes to Save")
                : "Save Identity Sheet"
              }
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
