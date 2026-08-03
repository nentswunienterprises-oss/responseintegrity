import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { ExecutivePortalGuard } from "@/lib/portalGuard";
import ExecutiveCommandRhythmDashboard from "@/pages/executive/command-rhythm-dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Brain,
  Users,
  ListTodo,
  Target,
  Lightbulb,
  Plus,
  User,
  Calendar,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Upload,
  Loader2,
  Search,
  Filter,
} from "lucide-react";
import type { PersonRegistry, Detail, Project, Idea } from "@shared/schema";

export default function BrainModule() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"registry" | "contribution">("registry");
  const [activeRegistryTab, setActiveRegistryTab] = useState("people");
  
  // Modal states
  const [showPersonModal, setShowPersonModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showIdeaModal, setShowIdeaModal] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<PersonRegistry | null>(null);
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch data
  const { data: people = [], isLoading: peopleLoading } = useQuery<PersonRegistry[]>({
    queryKey: ["/api/hr/brain/people"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: details = [], isLoading: detailsLoading } = useQuery<(Detail & { person: PersonRegistry })[]>({
    queryKey: ["/api/hr/brain/details"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery<(Project & { owner: PersonRegistry })[]>({
    queryKey: ["/api/hr/brain/projects"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: ideas = [], isLoading: ideasLoading } = useQuery<Idea[]>({
    queryKey: ["/api/hr/brain/ideas"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  // Mutations
  const createPerson = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/hr/brain/people", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/brain/people"] });
      setShowPersonModal(false);
      toast({ title: "Person added to registry" });
    },
  });

  const createDetail = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/hr/brain/details", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/brain/details"] });
      setShowDetailModal(false);
      toast({ title: "Detail assigned" });
    },
  });

  const markDetailDone = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/hr/brain/details/${id}/done`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/brain/details"] });
      toast({ title: "Detail marked as done" });
    },
  });

  const createProject = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/hr/brain/projects", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/brain/projects"] });
      setShowProjectModal(false);
      toast({ title: "Project created" });
    },
  });

  const updateIdeaStatus = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      return apiRequest("PATCH", `/api/hr/brain/ideas/${id}/status`, { status, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/brain/ideas"] });
      setShowIdeaModal(false);
      toast({ title: "Idea status updated" });
    },
  });

  const convertIdeaToProject = useMutation({
    mutationFn: async (ideaId: string) => {
      return apiRequest("POST", `/api/hr/brain/ideas/${ideaId}/convert`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/brain/ideas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/brain/projects"] });
      setShowIdeaModal(false);
      toast({ title: "Idea converted to project" });
    },
  });

  // Filter functions
  const filteredPeople = people.filter(p => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (searchQuery && !p.fullName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const pendingDetails = details.filter(d => d.status === "pending");
  const doneDetails = details.filter(d => d.status === "done");
  const missedDetails = details.filter(d => d.status === "missed");

  const activeProjects = projects.filter(p => p.status === "active");
  const atRiskProjects = projects.filter(p => p.status === "at_risk");
  const completedProjects = projects.filter(p => p.status === "completed");

  const newIdeas = ideas.filter(i => i.status === "new");
  const reviewedIdeas = ideas.filter(i => i.status === "reviewed");
  const approvedIdeas = ideas.filter(i => i.status === "approved");

  const userRole = user?.role;

  return (
    <ExecutivePortalGuard role={userRole}>
      <div className="p-4 md:p-8 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Brain className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Brain</h1>
          </div>
          <p className="text-muted-foreground">
            The thinking, execution, and institutional memory of the company
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-xl border border-primary/15 bg-muted/20 p-1">
            <TabsTrigger value="registry" className="gap-2">
              <Users className="w-4 h-4" />
              Registry
            </TabsTrigger>
            <TabsTrigger value="contribution" className="gap-2">
              <Lightbulb className="w-4 h-4" />
              Contribution
            </TabsTrigger>
          </TabsList>

          <TabsContent value="registry" className="space-y-6">
            <Tabs value={activeRegistryTab} onValueChange={setActiveRegistryTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4 rounded-xl border border-primary/15 bg-muted/20 p-1">
                <TabsTrigger value="people" className="gap-2">
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">People</span>
                  <Badge variant="secondary" className="ml-1">{people.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="details" className="gap-2">
                  <ListTodo className="w-4 h-4" />
                  <span className="hidden sm:inline">Details</span>
                  <Badge variant="secondary" className="ml-1">{pendingDetails.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="projects" className="gap-2">
                  <Target className="w-4 h-4" />
                  <span className="hidden sm:inline">Projects</span>
                  <Badge variant="secondary" className="ml-1">{activeProjects.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="ideas" className="gap-2">
                  <Lightbulb className="w-4 h-4" />
                  <span className="hidden sm:inline">Ideas</span>
                  <Badge variant="secondary" className="ml-1">{newIdeas.length}</Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="people" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
              <div className="flex gap-2 flex-1">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search people..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="exiting">Exiting</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => setShowPersonModal(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Add Person
              </Button>
            </div>

            {peopleLoading ? (
              <Card className="p-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
              </Card>
            ) : filteredPeople.length === 0 ? (
              <Card className="p-12 text-center">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No people in registry</p>
                <p className="text-sm text-muted-foreground mt-1">
                  If you're not in the registry, you don't exist operationally.
                </p>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredPeople.map((person) => (
                  <PersonCard
                    key={person.id}
                    person={person}
                    onSelect={() => setSelectedPerson(person)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={() => setShowDetailModal(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Assign Detail
              </Button>
            </div>

            {detailsLoading ? (
              <Card className="p-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
              </Card>
            ) : details.length === 0 ? (
              <Card className="p-12 text-center">
                <ListTodo className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No details assigned</p>
                <p className="text-sm text-muted-foreground mt-1">
                  You manage youth with visible commitments, not time sheets.
                </p>
              </Card>
            ) : (
              <>
                {pendingDetails.length > 0 && (
                  <DetailSection
                    title="Pending"
                    icon={<Clock className="w-5 h-5 text-yellow-500" />}
                    details={pendingDetails}
                    onMarkDone={(id) => markDetailDone.mutate(id)}
                  />
                )}
                {missedDetails.length > 0 && (
                  <DetailSection
                    title="Missed"
                    icon={<XCircle className="w-5 h-5 text-red-500" />}
                    details={missedDetails}
                    showMissedWarning
                  />
                )}
                {doneDetails.length > 0 && (
                  <DetailSection
                    title="Done"
                    icon={<CheckCircle2 className="w-5 h-5 text-green-500" />}
                    details={doneDetails}
                  />
                )}
              </>
            )}
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects" className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={() => setShowProjectModal(true)} className="gap-2" disabled={people.length === 0}>
                <Plus className="w-4 h-4" />
                Create Project
              </Button>
            </div>

            {projectsLoading ? (
              <Card className="p-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
              </Card>
            ) : projects.length === 0 ? (
              <Card className="p-12 text-center">
                <Target className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No projects yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Projects only exist if they move revenue, reputation, or systems.
                </p>
              </Card>
            ) : (
              <>
                {atRiskProjects.length > 0 && (
                  <ProjectSection
                    title="At Risk"
                    icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
                    projects={atRiskProjects}
                  />
                )}
                {activeProjects.length > 0 && (
                  <ProjectSection
                    title="Active"
                    icon={<Target className="w-5 h-5 text-blue-500" />}
                    projects={activeProjects}
                  />
                )}
                {completedProjects.length > 0 && (
                  <ProjectSection
                    title="Completed"
                    icon={<CheckCircle2 className="w-5 h-5 text-green-500" />}
                    projects={completedProjects}
                  />
                )}
              </>
            )}
          </TabsContent>

          {/* Ideas Tab */}
          <TabsContent value="ideas" className="space-y-6">
            {ideasLoading ? (
              <Card className="p-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
              </Card>
            ) : ideas.length === 0 ? (
              <Card className="p-12 text-center">
                <Lightbulb className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No ideas submitted</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Ideas don't move the company. Approved ideas do.
                </p>
              </Card>
            ) : (
              <>
                {newIdeas.length > 0 && (
                  <IdeaSection
                    title="New Ideas"
                    icon={<Lightbulb className="w-5 h-5 text-yellow-500" />}
                    ideas={newIdeas}
                    onReview={(idea) => { setSelectedIdea(idea); setShowIdeaModal(true); }}
                  />
                )}
                {reviewedIdeas.length > 0 && (
                  <IdeaSection
                    title="Under Review"
                    icon={<Clock className="w-5 h-5 text-blue-500" />}
                    ideas={reviewedIdeas}
                    onReview={(idea) => { setSelectedIdea(idea); setShowIdeaModal(true); }}
                  />
                )}
                {approvedIdeas.length > 0 && (
                  <IdeaSection
                    title="Approved"
                    icon={<CheckCircle2 className="w-5 h-5 text-green-500" />}
                    ideas={approvedIdeas}
                    onReview={(idea) => { setSelectedIdea(idea); setShowIdeaModal(true); }}
                  />
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </TabsContent>

      <TabsContent value="contribution" className="space-y-6">
        <ExecutiveCommandRhythmDashboard hideTabs />
      </TabsContent>
    </Tabs>

        {/* Add Person Modal */}
        <AddPersonModal
          open={showPersonModal}
          onOpenChange={setShowPersonModal}
          onSubmit={(data) => createPerson.mutate(data)}
          isLoading={createPerson.isPending}
        />

        {/* Add Detail Modal */}
        <AddDetailModal
          open={showDetailModal}
          onOpenChange={setShowDetailModal}
          people={people}
          onSubmit={(data) => createDetail.mutate(data)}
          isLoading={createDetail.isPending}
        />

        {/* Add Project Modal */}
        <AddProjectModal
          open={showProjectModal}
          onOpenChange={setShowProjectModal}
          people={people}
          onSubmit={(data) => createProject.mutate(data)}
          isLoading={createProject.isPending}
        />

        {/* Review Idea Modal */}
        {selectedIdea && (
          <ReviewIdeaModal
            open={showIdeaModal}
            onOpenChange={setShowIdeaModal}
            idea={selectedIdea}
            onUpdateStatus={(status, notes) => updateIdeaStatus.mutate({ id: selectedIdea.id, status, notes })}
            onConvertToProject={() => convertIdeaToProject.mutate(selectedIdea.id)}
            isLoading={updateIdeaStatus.isPending || convertIdeaToProject.isPending}
          />
        )}
      </div>
    </ExecutivePortalGuard>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function PersonCard({ person, onSelect }: { person: PersonRegistry; onSelect: () => void }) {
  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    paused: "bg-yellow-100 text-yellow-800",
    exiting: "bg-red-100 text-red-800",
  };

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onSelect}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{person.fullName}</CardTitle>
              <CardDescription>{person.roleTitle}</CardDescription>
            </div>
          </div>
          <Badge className={statusColors[person.status]}>{person.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {person.shortBio && <p className="line-clamp-2">{person.shortBio}</p>}
        {person.startDate && (
          <p className="mt-2 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Started {format(new Date(person.startDate), "MMM yyyy")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function DetailSection({
  title,
  icon,
  details,
  onMarkDone,
  showMissedWarning,
}: {
  title: string;
  icon: React.ReactNode;
  details: (Detail & { person: PersonRegistry })[];
  onMarkDone?: (id: string) => void;
  showMissedWarning?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-xl font-semibold">{title} ({details.length})</h2>
        {showMissedWarning && (
          <Badge variant="outline" className="text-red-600 border-red-300">
            HR Signal
          </Badge>
        )}
      </div>
      <div className="grid gap-3">
        {details.map((detail) => (
          <Card key={detail.id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="font-medium">{detail.description}</p>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {detail.person?.fullName || "Unknown"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Due {format(new Date(detail.dueDate), "MMM d")}
                  </span>
                </div>
              </div>
              {onMarkDone && detail.status === "pending" && (
                <Button size="sm" variant="outline" onClick={() => onMarkDone(detail.id)}>
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Done
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ProjectSection({
  title,
  icon,
  projects,
}: {
  title: string;
  icon: React.ReactNode;
  projects: (Project & { owner: PersonRegistry })[];
}) {
  const horizonLabels: Record<string, string> = {
    "30": "30 days",
    "60": "60 days",
    "90": "90 days",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-xl font-semibold">{title} ({projects.length})</h2>
      </div>
      <div className="grid gap-4">
        {projects.map((project) => (
          <Card key={project.id} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-lg">{project.name}</h3>
                <p className="text-muted-foreground mt-1">{project.objective}</p>
                <div className="flex items-center gap-4 mt-3 text-sm">
                  <Badge variant="outline">{horizonLabels[project.horizon]}</Badge>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {project.owner?.fullName || "Unassigned"}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function IdeaSection({
  title,
  icon,
  ideas,
  onReview,
}: {
  title: string;
  icon: React.ReactNode;
  ideas: Idea[];
  onReview: (idea: Idea) => void;
}) {
  const pillarColors: Record<string, string> = {
    revenue: "bg-green-100 text-green-800",
    reputation: "bg-blue-100 text-blue-800",
    systems: "bg-purple-100 text-purple-800",
    culture: "bg-orange-100 text-orange-800",
    other: "bg-gray-100 text-gray-800",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-xl font-semibold">{title} ({ideas.length})</h2>
      </div>
      <div className="grid gap-4">
        {ideas.map((idea) => (
          <Card key={idea.id} className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onReview(idea)}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{idea.title}</h3>
                  <Badge className={pillarColors[idea.pillar]}>{idea.pillar}</Badge>
                </div>
                <p className="text-muted-foreground mt-2 line-clamp-2">{idea.description}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Submitted by {idea.submitterName || "Unknown"} • {format(new Date(idea.createdAt), "MMM d")}
                </p>
              </div>
              <Button variant="outline" size="sm">Review</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================
// MODAL COMPONENTS
// ============================================

function AddPersonModal({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    fullName: "",
    roleTitle: "",
    roleDescription: "",
    shortBio: "",
    teamName: "",
    email: "",
    phone: "",
    status: "active",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add to People Registry</DialogTitle>
          <DialogDescription>
            Add a new person to the organizational registry.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4">
            <div>
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="roleTitle">Role Title *</Label>
              <Input
                id="roleTitle"
                value={formData.roleTitle}
                onChange={(e) => setFormData({ ...formData, roleTitle: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="roleDescription">Role Description (What winning looks like)</Label>
              <Textarea
                id="roleDescription"
                value={formData.roleDescription}
                onChange={(e) => setFormData({ ...formData, roleDescription: e.target.value })}
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="shortBio">Short Bio (How they see themselves)</Label>
              <Textarea
                id="shortBio"
                value={formData.shortBio}
                onChange={(e) => setFormData({ ...formData, shortBio: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="teamName">Team / Pod</Label>
                <Input
                  id="teamName"
                  value={formData.teamName}
                  onChange={(e) => setFormData({ ...formData, teamName: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="exiting">Exiting</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Person
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddDetailModal({
  open,
  onOpenChange,
  people,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  people: PersonRegistry[];
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    personId: "",
    description: "",
    dueDate: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Weekly Detail</DialogTitle>
          <DialogDescription>
            Assign a deliverable to a team member. No essays - just execution signals.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="personId">Assign To *</Label>
            <Select value={formData.personId} onValueChange={(v) => setFormData({ ...formData, personId: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select person" />
              </SelectTrigger>
              <SelectContent>
                {people.filter(p => p.status === "active").map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.fullName} - {person.roleTitle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What needs to be delivered?"
              required
            />
          </div>
          <div>
            <Label htmlFor="dueDate">Due Date *</Label>
            <Input
              id="dueDate"
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !formData.personId}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Assign Detail
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddProjectModal({
  open,
  onOpenChange,
  people,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  people: PersonRegistry[];
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    name: "",
    ownerId: "",
    horizon: "30",
    objective: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
          <DialogDescription>
            Projects only exist if they move revenue, reputation, or systems.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Project Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="ownerId">Owner (Single Throat to Choke) *</Label>
            <Select value={formData.ownerId} onValueChange={(v) => setFormData({ ...formData, ownerId: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select owner" />
              </SelectTrigger>
              <SelectContent>
                {people.filter(p => p.status === "active").map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="horizon">Time Horizon *</Label>
            <Select value={formData.horizon} onValueChange={(v) => setFormData({ ...formData, horizon: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 Days</SelectItem>
                <SelectItem value="60">60 Days</SelectItem>
                <SelectItem value="90">90 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="objective">Objective (1 sentence) *</Label>
            <Textarea
              id="objective"
              value={formData.objective}
              onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
              placeholder="What is this project trying to achieve?"
              rows={2}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !formData.ownerId}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReviewIdeaModal({
  open,
  onOpenChange,
  idea,
  onUpdateStatus,
  onConvertToProject,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idea: Idea;
  onUpdateStatus: (status: string, notes?: string) => void;
  onConvertToProject: () => void;
  isLoading: boolean;
}) {
  const [notes, setNotes] = useState("");

  const pillarColors: Record<string, string> = {
    revenue: "bg-green-100 text-green-800",
    reputation: "bg-blue-100 text-blue-800",
    systems: "bg-purple-100 text-purple-800",
    culture: "bg-orange-100 text-orange-800",
    other: "bg-gray-100 text-gray-800",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{idea.title}</DialogTitle>
          <DialogDescription>
            Review and take action on this idea.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge className={pillarColors[idea.pillar]}>{idea.pillar}</Badge>
            <span className="text-sm text-muted-foreground">
              by {idea.submitterName || "Unknown"} • {format(new Date(idea.createdAt), "MMM d, yyyy")}
            </span>
          </div>
          <div>
            <Label className="text-muted-foreground">Description</Label>
            <p className="mt-1">{idea.description}</p>
          </div>
          {idea.problemSolved && (
            <div>
              <Label className="text-muted-foreground">Problem Solved</Label>
              <p className="mt-1">{idea.problemSolved}</p>
            </div>
          )}
          <div>
            <Label htmlFor="notes">Review Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this idea..."
              rows={2}
            />
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onUpdateStatus("archived", notes)}
            disabled={isLoading}
          >
            Archive
          </Button>
          <Button
            variant="outline"
            onClick={() => onUpdateStatus("reviewed", notes)}
            disabled={isLoading}
          >
            Mark Reviewed
          </Button>
          {idea.status !== "approved" && (
            <Button
              onClick={() => onUpdateStatus("approved", notes)}
              disabled={isLoading}
            >
              Approve
            </Button>
          )}
          {idea.status === "approved" && !idea.convertedToProjectId && (
            <Button
              onClick={onConvertToProject}
              disabled={isLoading}
              className="gap-2"
            >
              <Target className="w-4 h-4" />
              Convert to Project
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
