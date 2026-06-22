// Shared TypeScript types for VitalBridge

export type UserRole = 'patient' | 'doctor' | 'health_worker' | 'admin';
export type SeverityLevel = 'low' | 'medium' | 'high' | 'pending';
export type ConversationStatus = 'active' | 'escalated' | 'resolved' | 'closed';
export type MessageRole = 'patient' | 'ai' | 'doctor';
export type AlertLevel = 'normal' | 'watch' | 'warning' | 'critical';
export type DispenserState = 'locked' | 'dose_window_open' | 'dispensed' | 'missed';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  city?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Patient {
  id: string;
  user_id: string;
  date_of_birth?: string;
  gender?: string;
  phone?: string;
  city?: string;
  state?: string;
  blood_group?: string;
  allergies: string[];
  chronic_conditions: string[];
  last_risk_score?: number;
  last_risk_band?: 'low' | 'moderate' | 'high';
}

export interface Doctor {
  id: string;
  user_id: string;
  specialty: string;
  hospital?: string;
  city?: string;
  is_available: boolean;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  metadata_?: Record<string, unknown>;
  created_at: string;
}

export interface Conversation {
  id: string;
  patient_id: string;
  severity: SeverityLevel;
  status: ConversationStatus;
  chief_complaint?: string;
  ai_summary?: string;
  assigned_doctor_id?: string;
  region?: string;
  created_at: string;
  updated_at: string;
  messages: ChatMessage[];
}

export interface ConversationSummary {
  id: string;
  severity: SeverityLevel;
  status: ConversationStatus;
  chief_complaint?: string;
  ai_summary?: string;
  created_at: string;
}

export interface Prescription {
  id: string;
  patient_id: string;
  doctor_id: string;
  medications: MedicationItem[];
  diagnosis?: string;
  notes?: string;
  created_at: string;
}

export interface MedicationItem {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

export interface VitalReading {
  id: string;
  patient_id: string;
  reading_type: string;
  value: number;
  unit: string;
  source: string;
  recorded_at: string;
}

export interface SurveillanceReport {
  id: string;
  region: string;
  latitude: number;
  longitude: number;
  symptom_category: string;
  case_count: number;
  risk_score: number;
  alert_level: AlertLevel;
  created_at: string;
}

export interface SurveillanceRegionSummary {
  region: string;
  latitude: number;
  longitude: number;
  total_cases: number;
  max_risk_score: number;
  alert_level: AlertLevel;
  categories: Record<string, number>;
}

export interface SurveillanceSummary {
  regions: SurveillanceRegionSummary[];
  total_cases: number;
  critical_regions: number;
  warning_regions: number;
  recent_triages_24h: number;
  total_regions: number;
}

export interface DoctorQueueItem {
  conversation_id: string;
  patient_name: string;
  chief_complaint?: string;
  severity: SeverityLevel;
  created_at: string;
  ai_summary?: string;
  last_risk_score?: number;
  last_risk_band?: 'low' | 'moderate' | 'high';
  patient_city?: string;
}

export interface DispenserDevice {
  id: string;
  patient_id: string;
  device_name: string;
  medication_name: string;
  dosage: string;
  schedule_times: string[];
  state: DispenserState;
  is_simulated: boolean;
}

export interface DispenserEvent {
  id: string;
  device_id: string;
  event_type: string;
  from_state?: string;
  to_state?: string;
  payload?: Record<string, unknown>;
  created_at: string;
}

export interface AdminDispenserDevice {
  device_id: string;
  device_name: string;
  patient_name: string;
  patient_age: number | null;
  patient_gender: string | null;
  patient_city: string | null;
  medication_name: string;
  dosage: string;
  state: DispenserState;
  adherence_rate: number;
  last_event_time: string | null;
  is_simulated: boolean;
}

