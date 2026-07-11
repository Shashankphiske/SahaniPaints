export type SellingUnit = "METER" | "FEET" | "INCHES" | "CENTIMETER" | "PANHA" | "RFT" | "SQFT" | "SQM" | "SQY" | "ROLL" | "PIECE" | "PANEL" | "PCS";

export type Role = "ADMIN" | "SALES_ASSOCIATE" | "INTERIOR" | "USER";

export interface Brand {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
}

export interface Customer {
  id: string;
  name: string;
  phonenumber: string | null; 
  email: string | null;
  alternatePhonenumber: string | null;
  address: string | null;
  createdAt: Date;
}

export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  role: Role;
  createdAt: Date;
  phonenumber: string | null;
  alternatePhonenumber: string | null;
  address: string | null;
}

export interface Inquiry {
  id: string;
  projectName: string;
  customerName: string;
  phonenumber: string;
  comments: string | null;
  createdAt: Date;
  followUpDate: Date;
}

export interface InquiryData {
  projectName: string;
  customerName: string;
  phonenumber: string;
  comments?: string;
  createdAt: Date;
  followUpDate: string;
}

export type Priority = "HIGH" | "MODERATE" | "LOW";
export type Status = "TODO" | "INPROGRESS" | "COMPLETED";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  taskDate: Date;
  projectId: string;
  priority: Priority;
  status: Status;
  createdAt: Date;
  project: {
    id: string;
    name: string;
  };
}

export interface TaskData {
  title: string;
  description?: string;
  taskDate: Date;
  projectId: string;
  priority: Priority;
  status: Status;
}

export type ProjectStatus = "PENDING" | "ACTIVE" | "GOODS_PENDING" | "GOODS_COMPLETE" | "TAILOR_PENDING" | "TAILOR_COMPLETE" | "COMPLETED" | "DEFAULTER";

export interface ProjectProduct {
  id: string;
  projectId: string;
  productId: string;
  area: number;
  unit: string;
  rate: number;
  litresUsed?: number | null;
  createdAt: Date;
  product?: Product;
}

export interface Project {
  id: string;
  name: string;
  customerId: string | null;
  totalAmount: number | null;
  paid: number | null;
  discount: number | null;
  discountType: string | null;
  tax: number | null;
  agreedPrice: number | null;
  projectDate: Date;
  status: ProjectStatus;
  createdAt: Date;
  creatorId: string;
  customer?: {
    id: string;
    name: string;
    phonenumber: string | null;
    email: string | null;
    address: string | null;
  } | null;
  creator: {
    username: string;
  };
  projectProducts?: ProjectProduct[];
  attendance?: any[];
  tasks?: any[];
  labourPayments?: any[];
  materialLogs?: any[];
  projectPayments?: any[];
  contractorPayments?: any[];
}

export interface ProjectData {
  name: string;
  customerId?: string | null;
  totalAmount?: number | null;
  paid?: number | null;
  discount?: number | null;
  discountType?: string | null;
  tax?: number | null;
  agreedPrice?: number | null;
  projectDate: Date;
  status: ProjectStatus;
  createdAt?: Date;
  creatorId?: string;
  projectProducts?: any[];
}

export interface Authorization {
    id: string;
    userId: string;
    access: string;
}

export interface Product {
  id: string;
  name: string;
  brandId: string;
  category: string;
  price: number | any;
  coverageSqFt?: number | any;
  coverageRnFt?: number | any;
  hasToken?: boolean;
  size?: string;
  createdAt: Date;
  brand?: {
    id: string;
    name: string;
  };
}

export interface Color {
  id: string;
  name: string;
  shade: string;
  createdAt: Date;
}

export interface Area {
  id: string;
  name: string;
  projectId?: string;
  createdAt: Date;
  projectAreaColors?: ProjectAreaColor[];
}

export interface ProjectAreaColor {
  id: string;
  projectId: string;
  areaId: string;
  colorId: string;
  description?: string | null;
  createdAt: Date;
  color?: Color;
  area?: Area;
}

export interface Labour {
  id: string;
  name: string;
  paymentPerDay: number | any;
  phonenumber: string | null;
  type: "WEEKLY" | "MONTHLY";
  createdAt: Date;
}

export interface LabourAttendance {
  id: string;
  date: Date;
  projectId: string;
  labourId: string;
  workDayType?: string;
  workDayValue?: number | any;
  markedById?: string | null;
  createdAt: Date;
  project?: {
    name: string;
  };
  labour?: {
    name: string;
    paymentPerDay: number;
    phonenumber: string | null;
  };
  markedBy?: {
    id: string;
    username: string;
  } | null;
}

export interface LabourPayment {
  id: string;
  labourId: string;
  projectId?: string | null;
  amount: number;
  type: "INCOMING" | "OUTGOING";
  paymentDate: string;
  remarks?: string | null;
  createdAt: string;
  project?: {
    name: string;
  };
}

export interface LabourPaymentData {
  labourId: string;
  projectId?: string | null;
  amount: number;
  paymentDate?: string;
  remarks?: string | null;
}

export interface ProjectMaterialLog {
  id: string;
  date: string;
  projectId: string;
  productId: string;
  quantity: number;
  createdAt: string;
  project?: {
    name: string;
  };
  product?: {
    name: string;
    price: number;
    size?: string;
  };
}

export interface ProjectPayment {
  id: string;
  projectId: string;
  amount: number;
  type: "INCOMING" | "OUTGOING";
  paymentDate: string;
  remarks?: string | null;
  createdAt: string;
  project?: {
    name: string;
  };
}

export interface Contractor {
  id: string;
  name: string;
  phonenumber?: string | null;
  email?: string | null;
  address?: string | null;
  type: "WEEKLY" | "MONTHLY";
  createdAt: string;
}

export interface ContractorPayment {
  id: string;
  contractorId: string;
  projectId?: string | null;
  amount: number;
  type: "INCOMING" | "OUTGOING";
  paymentDate: string;
  remarks?: string | null;
  createdAt: string;
  contractor?: {
    name: string;
  };
  project?: {
    name: string;
  };
}
