import React, { useState, useEffect, useRef } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { apiRequest } from "../../lib/api";
import { Switch } from "../ui/switch";

interface MasterFormProps {
  resource: "customers" | "brands" | "users" | "tasks" | "inquiries" | "interiors" | "sales-associates" | "products" | "colors" | "labours" | "areas" | "contractors";
  initialData?: any;
  editing?: boolean;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

const CATEGORIES = ["Emulsion", "Enamel", "Exterior", "Interior", "Putty", "Primer"];
const PRIORITIES = [
  { value: "LOW", label: "Low" },
  { value: "MODERATE", label: "Moderate" },
  { value: "HIGH", label: "High" }
];
const STATUSES = [
  { value: "TODO", label: "To Do" },
  { value: "INPROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" }
];
const ROLES = [
  { value: "INTERIOR", label: "Interior Designer" },
  { value: "SALES_ASSOCIATE", label: "Sales Associate" },
  { value: "ADMIN", label: "Administrator" },
  { value: "USER", label: "Standard User" }
];

const RESOURCE_FIELDS: Record<string, string[]> = {
  customers: ["name", "email", "phonenumber", "alternatePhonenumber", "address"],
  interiors: ["name", "email", "phonenumber", "alternatePhonenumber", "address", "commissionFeePercentage"],
  brands: ["name", "description"],
  users: ["username", "email", "password", "phonenumber", "role", "address"],
  tasks: ["title", "projectId", "priority", "status", "taskDate", "description"],
  inquiries: ["projectName", "customerName", "phonenumber", "followUpDate", "comments"],
  products: ["name", "brandId", "category", "price", "coverageSqFt", "coverageRnFt", "hasToken", "size"],
  colors: ["name", "shade"],
  labours: ["name", "paymentPerDay", "phonenumber", "type"],
  areas: ["name"],
  contractors: ["name", "phonenumber", "email", "address", "type", "pricePerSqFt"]
};

function useClickOutside(ref: React.RefObject<HTMLDivElement>, cb: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, cb]);
}

export function MasterForm({
  resource,
  initialData,
  editing = false,
  onSubmit,
  onCancel,
}: MasterFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Dynamic lists for select fields (e.g. projects for tasks)
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [brandsList, setBrandsList] = useState<any[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Backend search loading states for dynamic dropdowns
  const [brandSearching, setBrandSearching] = useState(false);
  const [projectSearching, setProjectSearching] = useState(false);

  // Helper: merge new items into a list deduplicating by id
  const mergeById = (existing: any[], incoming: any[]) => {
    const map = new Map(existing.map((x) => [x.id, x]));
    incoming.forEach((x) => map.set(x.id, x));
    return Array.from(map.values());
  };

  // Backend search handlers (called on Enter key)
  const searchBrandsFromServer = async (term: string) => {
    if (!term.trim()) return;
    setBrandSearching(true);
    try {
      const results = await apiRequest.fetchAll<any>("brands", { search: term });
      const list = Array.isArray(results) ? results : [];
      setBrandsList((prev) => mergeById(prev, list));
      setBrandOpen(true);
    } catch {
      // silently ignore
    } finally {
      setBrandSearching(false);
    }
  };

  const searchProjectsFromServer = async (term: string) => {
    if (!term.trim()) return;
    setProjectSearching(true);
    try {
      const results = await apiRequest.fetchAll<any>("projects", { search: term });
      const list = Array.isArray(results) ? results : [];
      setProjectsList((prev) => mergeById(prev, list));
      setProjectOpen(true);
    } catch {
      // silently ignore
    } finally {
      setProjectSearching(false);
    }
  };

  // Searchable dropdown states
  const [brandSearch, setBrandSearch] = useState("");
  const [brandOpen, setBrandOpen] = useState(false);
  const brandRef = useRef<HTMLDivElement>(null);
  useClickOutside(brandRef, () => setBrandOpen(false));

  const [categorySearch, setCategorySearch] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);
  useClickOutside(categoryRef, () => setCategoryOpen(false));

  const [projectSearch, setProjectSearch] = useState("");
  const [projectOpen, setProjectOpen] = useState(false);
  const projectRef = useRef<HTMLDivElement>(null);
  useClickOutside(projectRef, () => setProjectOpen(false));

  const [prioritySearch, setPrioritySearch] = useState("");
  const [priorityOpen, setPriorityOpen] = useState(false);
  const priorityRef = useRef<HTMLDivElement>(null);
  useClickOutside(priorityRef, () => setPriorityOpen(false));

  const [statusSearch, setStatusSearch] = useState("");
  const [statusOpen, setStatusOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  useClickOutside(statusRef, () => setStatusOpen(false));

  const [roleSearch, setRoleSearch] = useState("");
  const [roleOpen, setRoleOpen] = useState(false);
  const roleRef = useRef<HTMLDivElement>(null);
  useClickOutside(roleRef, () => setRoleOpen(false));

  // Normalize resource name for submission
  const normalizedResource = 
    resource === "sales-associates" ? "users" : resource;

  useEffect(() => {
    // Set initial form values
    if (initialData) {
      const formattedData = { ...initialData };
      
      // Format dates for date inputs
      if (formattedData.taskDate) {
        formattedData.taskDate = new Date(formattedData.taskDate).toISOString().split("T")[0];
      }
      if (formattedData.followUpDate) {
        formattedData.followUpDate = new Date(formattedData.followUpDate).toISOString().split("T")[0];
      }
      
      // Don't pre-fill password fields for security
      if (normalizedResource === "users") {
        delete formattedData.password;
      }
      
      setFormData(formattedData);

      // Initialize search query labels for existing records
      if (resource === "products") {
        setBrandSearch(initialData.brand?.name || "");
        setCategorySearch(initialData.category || "");
      } else if (resource === "tasks") {
        setProjectSearch(initialData.project?.name || "");
        const matchedPriority = PRIORITIES.find(p => p.value === initialData.priority);
        setPrioritySearch(matchedPriority ? matchedPriority.label : "");
        const matchedStatus = STATUSES.find(s => s.value === initialData.status);
        setStatusSearch(matchedStatus ? matchedStatus.label : "");
      } else if (normalizedResource === "users") {
        const matchedRole = ROLES.find(r => r.value === initialData.role);
        setRoleSearch(matchedRole ? matchedRole.label : "");
      }
    } else {
      // Set default initial values for new records depending on the resource
      if (resource === "tasks") {
        setFormData({
          priority: "MODERATE",
          status: "TODO",
        });
        setProjectSearch("");
        setPrioritySearch("Moderate");
        setStatusSearch("To Do");
      } else if (normalizedResource === "users") {
        const initialRoleKey = resource === "interiors" ? "INTERIOR" : resource === "sales-associates" ? "SALES_ASSOCIATE" : "USER";
        setFormData({
          role: initialRoleKey
        });
        const initialRoleLabel = ROLES.find(r => r.value === initialRoleKey)?.label || "";
        setRoleSearch(initialRoleLabel);
      } else if (resource === "labours" || resource === "contractors") {
        setFormData({
          type: "WEEKLY"
        });
      } else {
        setFormData({});
      }

      // Reset other search states
      if (resource !== "tasks") {
        setProjectSearch("");
        setPrioritySearch("");
        setStatusSearch("");
      }
      if (normalizedResource !== "users") {
        setRoleSearch("");
      }
      setBrandSearch("");
      setCategorySearch("");
    }
    setErrors({});
  }, [initialData, resource]);

  // Load relation data for tasks form
  useEffect(() => {
    if (resource === "tasks") {
      setLoadingOptions(true);
      Promise.all([
        apiRequest.fetchAll("projects").catch(() => []),
        apiRequest.fetchAll("users").catch(() => []),
      ])
        .then(([projects, users]) => {
          setProjectsList(projects);
          setUsersList(users);
        })
        .finally(() => setLoadingOptions(false));
    } else if (resource === "products") {
      setLoadingOptions(true);
      apiRequest.fetchAll("brands")
        .then((brands) => {
          setBrandsList(brands);
        })
        .catch(() => [])
        .finally(() => setLoadingOptions(false));
    }
  }, [resource]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (normalizedResource === "customers") {
      if (!formData.name?.trim()) newErrors.name = "Customer name is required";
    }

    if (normalizedResource === "brands") {
      if (!formData.name?.trim()) newErrors.name = "Brand name is required";
    }

    if (normalizedResource === "users") {
      if (!formData.username?.trim()) newErrors.username = "Username is required";
      if (!formData.email?.trim()) newErrors.email = "Email is required";
      if (!editing && !formData.password?.trim()) {
        newErrors.password = "Password is required for new users";
      }
    }

    if (normalizedResource === "tasks") {
      if (!formData.title?.trim()) newErrors.title = "Task title is required";
      if (!formData.projectId) newErrors.projectId = "Project is required";
      if (!formData.taskDate) newErrors.taskDate = "Task Date is required";
    }

    if (normalizedResource === "inquiries") {
      if (!formData.projectName?.trim()) newErrors.projectName = "Project name is required";
      if (!formData.customerName?.trim()) newErrors.customerName = "Customer name is required";
      if (!formData.phonenumber?.trim()) newErrors.phonenumber = "Phone number is required";
      if (!formData.followUpDate) newErrors.followUpDate = "Follow up date is required";
    }

    if (normalizedResource === "products") {
      if (!formData.name?.trim()) newErrors.name = "Product name is required";
      if (!formData.brandId) newErrors.brandId = "Brand is required";
      if (!formData.category) newErrors.category = "Category is required";
      if (formData.price === undefined || formData.price === null || formData.price === "" || isNaN(Number(formData.price)) || Number(formData.price) <= 0) {
        newErrors.price = "Valid price per litre is required";
      }
      if (formData.coverageSqFt !== undefined && formData.coverageSqFt !== null && formData.coverageSqFt !== "") {
        if (isNaN(Number(formData.coverageSqFt)) || Number(formData.coverageSqFt) < 0) {
          newErrors.coverageSqFt = "Coverage must be a valid positive number";
        }
      }
      if (formData.coverageRnFt !== undefined && formData.coverageRnFt !== null && formData.coverageRnFt !== "") {
        if (isNaN(Number(formData.coverageRnFt)) || Number(formData.coverageRnFt) < 0) {
          newErrors.coverageRnFt = "Coverage must be a valid positive number";
        }
      }
    }

    if (normalizedResource === "colors") {
      if (!formData.name?.trim()) newErrors.name = "Color name is required";
    }

    if (normalizedResource === "labours") {
      if (!formData.name?.trim()) newErrors.name = "Labour name is required";
      if (formData.paymentPerDay === undefined || formData.paymentPerDay === null || formData.paymentPerDay === "" || isNaN(Number(formData.paymentPerDay)) || Number(formData.paymentPerDay) <= 0) {
        newErrors.paymentPerDay = "Valid daily payment is required";
      }
    }

    if (resource === "areas") {
      if (!formData.name?.trim()) newErrors.name = "Area name is required";
    }

    if (normalizedResource === "contractors") {
      if (!formData.name?.trim()) newErrors.name = "Contractor name is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Filter fields based on whitelist
    const allowedFields = RESOURCE_FIELDS[normalizedResource];
    let payload: Record<string, any> = {};
    if (allowedFields) {
      Object.entries(formData).forEach(([key, value]) => {
        if (allowedFields.includes(key)) {
          payload[key] = value;
        }
      });
    } else {
      payload = { ...formData };
    }

    if (resource === "products") {
      if (payload.brandId) {
        const selectedBrand = brandsList.find(b => b.id === payload.brandId);
        if (selectedBrand) {
          payload._brandName = selectedBrand.name;
        }
      }
      if (payload.price !== undefined && payload.price !== null && payload.price !== "") {
        payload.price = Number(payload.price);
      }
      if (payload.coverageSqFt !== undefined && payload.coverageSqFt !== null && payload.coverageSqFt !== "") {
        payload.coverageSqFt = Number(payload.coverageSqFt);
      } else {
        payload.coverageSqFt = null;
      }
      if (payload.coverageRnFt !== undefined && payload.coverageRnFt !== null && payload.coverageRnFt !== "") {
        payload.coverageRnFt = Number(payload.coverageRnFt);
      } else {
        payload.coverageRnFt = null;
      }
      payload.hasToken = !!payload.hasToken;
      if (!payload.size) {
        payload.size = "1ltr";
      }
    }
    
    if (normalizedResource === "contractors") {
      if (payload.pricePerSqFt !== undefined && payload.pricePerSqFt !== null && payload.pricePerSqFt !== "") {
        payload.pricePerSqFt = Number(payload.pricePerSqFt);
      } else {
        payload.pricePerSqFt = null;
      }
    }
    
    // Automatically assign the role if creating/editing from a role-filtered page
    if (normalizedResource === "users" && !payload.role) {
      if (resource === "interiors") {
        payload.role = "INTERIOR";
      } else if (resource === "sales-associates") {
        payload.role = "SALES_ASSOCIATE";
      } else {
        payload.role = "USER";
      }
    }

    // Convert dates to ISO strings before submitting
    if (payload.taskDate) {
      payload.taskDate = new Date(payload.taskDate).toISOString();
    }
    if (payload.followUpDate) {
      payload.followUpDate = new Date(payload.followUpDate).toISOString();
    }

    onSubmit(payload);
  };

  const renderFormFields = () => {
    switch (normalizedResource) {
      case "customers":
      case "interiors":
        return (
          <>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-muted-foreground">Full Name <span className="text-red-500 font-bold ml-0.5">*</span></label>
              <Input
                name="name"
                value={formData.name || ""}
                onChange={handleChange}
                placeholder={normalizedResource === "interiors" ? "Enter interior designer name" : "Enter customer name"}
              />
              {errors.name && <p className="text-xs text-destructive font-semibold">{errors.name}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-muted-foreground">Email Address</label>
              <Input
                type="email"
                name="email"
                value={formData.email || ""}
                onChange={handleChange}
                placeholder="Enter email address"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-muted-foreground">Phone Number</label>
                <Input
                  name="phonenumber"
                  value={formData.phonenumber || ""}
                  onChange={handleChange}
                  placeholder="Primary phone"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-muted-foreground">Alternate Phone</label>
                <Input
                  name="alternatePhonenumber"
                  value={formData.alternatePhonenumber || ""}
                  onChange={handleChange}
                  placeholder="Secondary phone"
                />
              </div>
            </div>

            {normalizedResource === "interiors" && (
              <div className="space-y-1">
                <label className="text-sm font-semibold text-muted-foreground">Commission Fee Percentage (%)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  name="commissionFeePercentage"
                  value={formData.commissionFeePercentage ?? ""}
                  onChange={handleChange}
                  placeholder="e.g. 10.00"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-sm font-semibold text-muted-foreground">Address</label>
              <textarea
                name="address"
                value={formData.address || ""}
                onChange={handleChange}
                placeholder="Enter address details"
                rows={3}
                className="flex w-full rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </>
        );

      case "brands":
        return (
          <>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-muted-foreground">Brand Name <span className="text-red-500 font-bold ml-0.5">*</span></label>
              <Input
                name="name"
                value={formData.name || ""}
                onChange={handleChange}
                placeholder="Enter brand name"
              />
              {errors.name && <p className="text-xs text-destructive font-semibold">{errors.name}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-muted-foreground">Description</label>
              <textarea
                name="description"
                value={formData.description || ""}
                onChange={handleChange}
                placeholder="Brand details or comments"
                rows={4}
                className="flex w-full rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </>
        );

      case "users":
        return (
          <>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-muted-foreground">Username <span className="text-red-500 font-bold ml-0.5">*</span></label>
              <Input
                name="username"
                value={formData.username || ""}
                onChange={handleChange}
                placeholder="Enter username"
              />
              {errors.username && <p className="text-xs text-destructive font-semibold">{errors.username}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-muted-foreground">Email Address <span className="text-red-500 font-bold ml-0.5">*</span></label>
              <Input
                type="email"
                name="email"
                value={formData.email || ""}
                onChange={handleChange}
                placeholder="Enter email address"
              />
              {errors.email && <p className="text-xs text-destructive font-semibold">{errors.email}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-muted-foreground">
                Password {editing ? "(leave blank to keep current)" : <span className="text-red-500 font-bold ml-0.5">*</span>}
              </label>
              <Input
                type="password"
                name="password"
                value={formData.password || ""}
                onChange={handleChange}
                placeholder="Enter password"
              />
              {errors.password && <p className="text-xs text-destructive font-semibold">{errors.password}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-muted-foreground">Phone Number</label>
                <Input
                  name="phonenumber"
                  value={formData.phonenumber || ""}
                  onChange={handleChange}
                  placeholder="Phone number"
                />
              </div>
              
              {/* Only show role selector if resource is generic 'users' */}
              {resource === "users" && (
                <div ref={roleRef} className="space-y-1 relative">
                  <label className="text-sm font-semibold text-muted-foreground">Role <span className="text-red-500 font-bold ml-0.5">*</span></label>
                  <Input
                    placeholder="Search and select role..."
                    value={roleSearch}
                    onFocus={() => setRoleOpen(true)}
                    onChange={(e) => {
                      setRoleSearch(e.target.value);
                      setFormData(prev => ({ ...prev, role: "" }));
                      setRoleOpen(true);
                    }}
                  />
                  {roleOpen && (
                    <div className="absolute z-50 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 w-full rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
                      {ROLES.filter(r => r.label.toLowerCase().includes(roleSearch.toLowerCase()))
                        .map(r => (
                          <div
                            key={r.value}
                            className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-zinc-900 cursor-pointer text-sm text-slate-900 dark:text-slate-100 transition-colors duration-150"
                            onMouseDown={() => {
                              setFormData(prev => ({ ...prev, role: r.value }));
                              setRoleSearch(r.label);
                              setRoleOpen(false);
                            }}
                          >
                            {r.label}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-muted-foreground">Address</label>
              <textarea
                name="address"
                value={formData.address || ""}
                onChange={handleChange}
                placeholder="Enter address details"
                rows={3}
                className="flex w-full rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </>
        );

      case "tasks":
        return (
          <>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-muted-foreground">Task Title <span className="text-red-500 font-bold ml-0.5">*</span></label>
              <Input
                name="title"
                value={formData.title || ""}
                onChange={handleChange}
                placeholder="What needs to be done?"
              />
              {errors.title && <p className="text-xs text-destructive font-semibold">{errors.title}</p>}
            </div>

            <div ref={projectRef} className="space-y-1 relative">
              <label className="text-sm font-semibold text-muted-foreground">Project <span className="text-red-500 font-bold ml-0.5">*</span></label>
              <Input
                placeholder="Search and select project... (Enter to search server)"
                value={projectSearch}
                onFocus={() => setProjectOpen(true)}
                onChange={(e) => {
                  setProjectSearch(e.target.value);
                  setFormData(prev => ({ ...prev, projectId: "" }));
                  setProjectOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    searchProjectsFromServer(projectSearch);
                  }
                }}
              />
              {projectOpen && (
                <div className="absolute z-50 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 w-full rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
                  {projectSearching && (
                    <div className="px-3 py-2 text-xs text-muted-foreground italic">Searching server...</div>
                  )}
                  {projectsList.filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase()))
                    .map((p) => (
                      <div
                        key={p.id}
                        className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-zinc-900 cursor-pointer text-sm text-slate-900 dark:text-slate-100 transition-colors duration-150"
                        onMouseDown={() => {
                          setFormData(prev => ({ ...prev, projectId: p.id }));
                          setProjectSearch(p.name);
                          setProjectOpen(false);
                        }}
                      >
                        {p.name}
                      </div>
                    ))}
                  {!projectSearching && projectsList.filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase())).length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">No results — press Enter to search server</div>
                  )}
                </div>
              )}
              {errors.projectId && <p className="text-xs text-destructive font-semibold">{errors.projectId}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div ref={priorityRef} className="space-y-1 relative">
                <label className="text-sm font-semibold text-muted-foreground">Priority</label>
                <Input
                  placeholder="Search and select priority..."
                  value={prioritySearch}
                  onFocus={() => setPriorityOpen(true)}
                  onChange={(e) => {
                    setPrioritySearch(e.target.value);
                    setFormData(prev => ({ ...prev, priority: "" }));
                    setPriorityOpen(true);
                  }}
                />
                {priorityOpen && (
                  <div className="absolute z-50 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 w-full rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
                    {PRIORITIES.filter(p => p.label.toLowerCase().includes(prioritySearch.toLowerCase()))
                      .map((p) => (
                        <div
                          key={p.value}
                          className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-zinc-900 cursor-pointer text-sm text-slate-900 dark:text-slate-100 transition-colors duration-150"
                          onMouseDown={() => {
                            setFormData(prev => ({ ...prev, priority: p.value }));
                            setPrioritySearch(p.label);
                            setPriorityOpen(false);
                          }}
                        >
                          {p.label}
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div ref={statusRef} className="space-y-1 relative">
                <label className="text-sm font-semibold text-muted-foreground">Status</label>
                <Input
                  placeholder="Search and select status..."
                  value={statusSearch}
                  onFocus={() => setStatusOpen(true)}
                  onChange={(e) => {
                    setStatusSearch(e.target.value);
                    setFormData(prev => ({ ...prev, status: "" }));
                    setStatusOpen(true);
                  }}
                />
                {statusOpen && (
                  <div className="absolute z-50 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 w-full rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
                    {STATUSES.filter(s => s.label.toLowerCase().includes(statusSearch.toLowerCase()))
                      .map((s) => (
                        <div
                          key={s.value}
                          className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-zinc-900 cursor-pointer text-sm text-slate-900 dark:text-slate-100 transition-colors duration-150"
                          onMouseDown={() => {
                            setFormData(prev => ({ ...prev, status: s.value }));
                            setStatusSearch(s.label);
                            setStatusOpen(false);
                          }}
                        >
                          {s.label}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-muted-foreground">Task Deadline <span className="text-red-500 font-bold ml-0.5">*</span></label>
              <Input
                type="date"
                name="taskDate"
                value={formData.taskDate || ""}
                onChange={handleChange}
              />
              {errors.taskDate && <p className="text-xs text-destructive font-semibold">{errors.taskDate}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-muted-foreground">Description</label>
              <textarea
                name="description"
                value={formData.description || ""}
                onChange={handleChange}
                placeholder="Provide task notes..."
                rows={3}
                className="flex w-full rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </>
        );

      case "inquiries":
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-muted-foreground">Project Name <span className="text-red-500 font-bold ml-0.5">*</span></label>
                <Input
                  name="projectName"
                  value={formData.projectName || ""}
                  onChange={handleChange}
                  placeholder="e.g. Villa Painting"
                />
                {errors.projectName && <p className="text-xs text-destructive font-semibold">{errors.projectName}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-muted-foreground">Customer Name <span className="text-red-500 font-bold ml-0.5">*</span></label>
                <Input
                  name="customerName"
                  value={formData.customerName || ""}
                  onChange={handleChange}
                  placeholder="Customer name"
                />
                {errors.customerName && <p className="text-xs text-destructive font-semibold">{errors.customerName}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-muted-foreground">Phone Number <span className="text-red-500 font-bold ml-0.5">*</span></label>
                <Input
                  name="phonenumber"
                  value={formData.phonenumber || ""}
                  onChange={handleChange}
                  placeholder="Phone number"
                />
                {errors.phonenumber && <p className="text-xs text-destructive font-semibold">{errors.phonenumber}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Follow-Up Date <span className="text-red-500 font-bold ml-0.5">*</span></label>
                <Input
                  type="date"
                  name="followUpDate"
                  value={formData.followUpDate || ""}
                  onChange={handleChange}
                />
                {errors.followUpDate && <p className="text-xs text-destructive font-semibold">{errors.followUpDate}</p>}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Comments</label>
              <textarea
                name="comments"
                value={formData.comments || ""}
                onChange={handleChange}
                placeholder="Details of inquiry..."
                rows={4}
                className="flex w-full rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </>
        );

      case "products":
        return (
          <>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-500">Product Name <span className="text-red-500 font-bold ml-0.5">*</span></label>
              <Input
                name="name"
                value={formData.name || ""}
                onChange={handleChange}
                placeholder="Enter product name"
              />
              {errors.name && <p className="text-xs text-destructive font-semibold">{errors.name}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div ref={brandRef} className="space-y-1 relative">
                <label className="text-sm font-semibold text-slate-500">Brand <span className="text-red-500 font-bold ml-0.5">*</span></label>
                <Input
                  placeholder="Search and select brand... (Enter to search server)"
                  value={brandSearch}
                  onFocus={() => setBrandOpen(true)}
                  onChange={(e) => {
                    setBrandSearch(e.target.value);
                    setFormData(prev => ({ ...prev, brandId: "" }));
                    setBrandOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      searchBrandsFromServer(brandSearch);
                    }
                  }}
                />
                {brandOpen && (
                  <div className="absolute z-50 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 w-full rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
                    {brandSearching && (
                      <div className="px-3 py-2 text-xs text-muted-foreground italic">Searching server...</div>
                    )}
                    {brandsList.filter(b => b.name.toLowerCase().includes(brandSearch.toLowerCase()))
                      .map((b) => (
                        <div
                          key={b.id}
                          className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-zinc-900 cursor-pointer text-sm text-slate-900 dark:text-slate-100 transition-colors duration-150"
                          onMouseDown={() => {
                            setFormData(prev => ({ ...prev, brandId: b.id }));
                            setBrandSearch(b.name);
                            setBrandOpen(false);
                          }}
                        >
                          {b.name}
                        </div>
                      ))}
                    {!brandSearching && brandsList.filter(b => b.name.toLowerCase().includes(brandSearch.toLowerCase())).length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">No results — press Enter to search server</div>
                    )}
                  </div>
                )}
                {errors.brandId && <p className="text-xs text-destructive font-semibold">{errors.brandId}</p>}
              </div>

              <div ref={categoryRef} className="space-y-1 relative">
                <label className="text-sm font-semibold text-slate-500">Category <span className="text-red-500 font-bold ml-0.5">*</span></label>
                <Input
                  placeholder="Search and select category..."
                  value={categorySearch}
                  onFocus={() => setCategoryOpen(true)}
                  onChange={(e) => {
                    setCategorySearch(e.target.value);
                    setFormData(prev => ({ ...prev, category: "" }));
                    setCategoryOpen(true);
                  }}
                />
                {categoryOpen && (
                  <div className="absolute z-50 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 w-full rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
                    {CATEGORIES.filter(c => c.toLowerCase().includes(categorySearch.toLowerCase()))
                      .map((c) => (
                        <div
                          key={c}
                          className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-zinc-900 cursor-pointer text-sm text-slate-900 dark:text-slate-100 transition-colors duration-150"
                          onMouseDown={() => {
                            setFormData(prev => ({ ...prev, category: c }));
                            setCategorySearch(c);
                            setCategoryOpen(false);
                          }}
                        >
                          {c}
                        </div>
                      ))}
                  </div>
                )}
                {errors.category && <p className="text-xs text-destructive font-semibold">{errors.category}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-500">Price (₹ per litre) <span className="text-red-500 font-bold ml-0.5">*</span></label>
                <Input
                  type="number"
                  step="0.01"
                  name="price"
                  value={formData.price || ""}
                  onChange={handleChange}
                  placeholder="Enter price per litre"
                />
                {errors.price && <p className="text-xs text-destructive font-semibold">{errors.price}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-500">Pack Size <span className="text-red-500 font-bold ml-0.5">*</span></label>
                <select
                  name="size"
                  value={formData.size || "1ltr"}
                  onChange={handleChange}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="500ml">500ml</option>
                  <option value="1ltr">1ltr</option>
                  <option value="4ltr">4ltr</option>
                  <option value="10ltr">10ltr</option>
                  <option value="20ltr">20ltr</option>
                </select>
                {errors.size && <p className="text-xs text-destructive font-semibold">{errors.size}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-500">Coverage (sq.ft per L)</label>
                <Input
                  type="number"
                  step="any"
                  name="coverageSqFt"
                  value={formData.coverageSqFt || ""}
                  onChange={handleChange}
                  placeholder="e.g. 120"
                />
                {errors.coverageSqFt && <p className="text-xs text-destructive font-semibold">{errors.coverageSqFt}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-500">Coverage (rn.ft per L)</label>
                <Input
                  type="number"
                  step="any"
                  name="coverageRnFt"
                  value={formData.coverageRnFt || ""}
                  onChange={handleChange}
                  placeholder="e.g. 100"
                />
                {errors.coverageRnFt && <p className="text-xs text-destructive font-semibold">{errors.coverageRnFt}</p>}
              </div>
            </div>

            <div className="flex items-center space-x-2 py-2">
              <Switch
                id="hasToken"
                checked={!!formData.hasToken}
                onCheckedChange={(checked) => {
                  setFormData((prev) => ({
                    ...prev,
                    hasToken: checked,
                  }));
                }}
              />
              <label htmlFor="hasToken" className="text-sm font-semibold text-slate-500 cursor-pointer select-none">
                Has Token?
              </label>
            </div>
          </>
        );

      case "colors":
        return (
          <>
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Color Name <span className="text-red-500 font-bold ml-0.5">*</span></label>
              <Input
                name="name"
                value={formData.name || ""}
                onChange={handleChange}
                placeholder="Enter color name (e.g. Royal Blue)"
              />
              {errors.name && <p className="text-xs text-destructive font-semibold">{errors.name}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Shade Number</label>
              <Input
                name="shade"
                value={formData.shade || ""}
                onChange={handleChange}
                placeholder="Enter shade number (e.g. 4502)"
              />
            </div>
          </>
        );

      case "labours":
        return (
          <>
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Labour Name <span className="text-red-500 font-bold ml-0.5">*</span></label>
              <Input
                name="name"
                value={formData.name || ""}
                onChange={handleChange}
                placeholder="Enter labour name"
              />
              {errors.name && <p className="text-xs text-destructive font-semibold">{errors.name}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Payment Per Day (₹) <span className="text-red-500 font-bold ml-0.5">*</span></label>
              <Input
                type="number"
                name="paymentPerDay"
                value={formData.paymentPerDay || ""}
                onChange={handleChange}
                placeholder="Enter daily payment (e.g. 500)"
              />
              {errors.paymentPerDay && <p className="text-xs text-destructive font-semibold">{errors.paymentPerDay}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-muted-foreground flex items-center justify-between">
                <span>Tuesday Payment Amount (₹)</span>
                <span className="text-[11px] text-muted-foreground font-normal italic">(Optional)</span>
              </label>
              <Input
                type="number"
                name="tuesdayPaymentAmount"
                value={formData.tuesdayPaymentAmount ?? ""}
                onChange={handleChange}
                placeholder="Enter Tuesday diary payment amount (e.g. 1000)"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Phone Number</label>
              <Input
                name="phonenumber"
                value={formData.phonenumber || ""}
                onChange={handleChange}
                placeholder="Enter phone number"
              />
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Labour Type</label>
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-900 border dark:border-zinc-800 p-1 rounded-xl w-fit">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, type: "WEEKLY" }))}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    (formData.type || "WEEKLY") === "WEEKLY"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Weekly
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, type: "MONTHLY" }))}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    formData.type === "MONTHLY"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Monthly
                </button>
              </div>
            </div>
          </>
        );

      case "areas":
        return (
          <>
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Area Name <span className="text-red-500 font-bold ml-0.5">*</span></label>
              <Input
                name="name"
                value={formData.name || ""}
                onChange={handleChange}
                placeholder="Enter area name (e.g. Living Room)"
              />
              {errors.name && <p className="text-xs text-destructive font-semibold">{errors.name}</p>}
            </div>
          </>
        );

      case "contractors":
        return (
          <>
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Contractor Name <span className="text-red-500 font-bold ml-0.5">*</span></label>
              <Input
                name="name"
                value={formData.name || ""}
                onChange={handleChange}
                placeholder="Enter contractor name"
              />
              {errors.name && <p className="text-xs text-destructive font-semibold">{errors.name}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Phone Number</label>
              <Input
                name="phonenumber"
                value={formData.phonenumber || ""}
                onChange={handleChange}
                placeholder="Enter phone number"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <Input
                name="email"
                value={formData.email || ""}
                onChange={handleChange}
                placeholder="Enter email address"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-muted-foreground">Address</label>
              <Input
                name="address"
                value={formData.address || ""}
                onChange={handleChange}
                placeholder="Enter address"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-muted-foreground flex items-center justify-between">
                <span>Price per Sq.Ft (₹)</span>
                <span className="text-[11px] text-muted-foreground font-normal italic">(Optional)</span>
              </label>
              <Input
                type="number"
                name="pricePerSqFt"
                value={formData.pricePerSqFt ?? ""}
                onChange={handleChange}
                placeholder="Enter price per sq.ft (e.g. 15)"
              />
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Contractor Type</label>
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-900 border dark:border-zinc-800 p-1 rounded-xl w-fit">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, type: "WEEKLY" }))}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    (formData.type || "WEEKLY") === "WEEKLY"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Weekly
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, type: "MONTHLY" }))}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    formData.type === "MONTHLY"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Monthly
                </button>
              </div>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      {renderFormFields()}

      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {editing ? "Save Changes" : "Create"}
        </Button>
      </div>
    </form>
  );
}
