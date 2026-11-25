import React, { useEffect, useState } from 'react';
import { CalendarClock, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { AppointmentStatusBadge } from '../components/StatusBadge';
import { apiClient } from '../services/api';
import type { Appointment, Lead } from '../types';

export const AppointmentsPage: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [topic, setTopic] = useState<string>('SalesPilot AI Product Demo');
  const [confirming, setConfirming] = useState<boolean>(false);
  const [bookingMessage, setBookingMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadAppointments = async () => {
    setLoading(true);
    setError(null);
    try {
      const [appts, slotResp, leadsResp] = await Promise.all([
        apiClient.getAppointments(),
        apiClient.getAvailableSlots(selectedDate),
        apiClient.getLeads(),
      ]);
      setAppointments(appts);
      setAvailableSlots(slotResp.available_slots);
      setLeads(leadsResp);
      if (!selectedLeadId && leadsResp.length > 0) {
        setSelectedLeadId(String(leadsResp[0].id));
      }
      if (selectedSlot && !slotResp.available_slots.includes(selectedSlot)) {
        setSelectedSlot('');
      }
    } catch (err) {
      setAppointments([]);
      setAvailableSlots([]);
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load appointment schedule from backend.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAppointments();
  }, [selectedDate]);

  const handleBookSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId || !selectedSlot || confirming) return;

    setConfirming(true);
    setBookingMessage(null);
    try {
      const booked = await apiClient.bookAppointment({
        lead_id: Number(selectedLeadId),
        scheduled_date: selectedDate,
        scheduled_time: selectedSlot,
        topic: topic.trim() || undefined,
      });
      setBookingMessage({
        type: 'success',
        text: `Appointment confirmed in database for ${booked.scheduled_date} at ${booked.scheduled_time}.`,
      });
      setSelectedSlot('');
      await loadAppointments();
    } catch (err) {
      setBookingMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to book appointment.',
      });
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointment Scheduling"
        description="Check non-conflicting slots, confirm prospect demos with double-booking protection, and manage booked meetings."
        actions={
          <button
            type="button"
            onClick={() => void loadAppointments()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Calendar
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Interactive Booking Panel */}
        <Card className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Book Sales Demo</h2>
            <p className="text-xs text-slate-500">
              Select a date, open window, and CRM prospect to confirm
            </p>
          </div>

          <form onSubmit={(e) => void handleBookSlot(e)} className="space-y-4">
            <div>
              <label
                htmlFor="appointment-date"
                className="mb-1.5 block text-xs font-medium text-slate-700"
              >
                Target Date
              </label>
              <input
                id="appointment-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Available Windows
              </p>
              {availableSlots.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 font-mono text-xs font-medium transition-colors ${
                        selectedSlot === slot
                          ? 'border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-600'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5 text-brand-600" />
                      <span>{slot}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-500">
                  {error
                    ? 'Connect backend API to query live slot availability.'
                    : 'No open slots remain for this date.'}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="booking-lead"
                className="mb-1.5 block text-xs font-medium text-slate-700"
              >
                Associate CRM Lead
              </label>
              <select
                id="booking-lead"
                value={selectedLeadId}
                onChange={(e) => setSelectedLeadId(e.target.value)}
                disabled={leads.length === 0}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none disabled:opacity-50"
              >
                {leads.length === 0 ? (
                  <option value="">No leads available — create a lead first</option>
                ) : (
                  leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name || `Lead #${l.id}`} ({l.company || 'Unknown'})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label
                htmlFor="booking-topic"
                className="mb-1.5 block text-xs font-medium text-slate-700"
              >
                Meeting Topic
              </label>
              <input
                id="booking-topic"
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:bg-white focus:outline-none"
              />
            </div>

            {bookingMessage && (
              <div
                className={`flex items-start gap-2 rounded-lg border p-2.5 text-xs ${
                  bookingMessage.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-rose-200 bg-rose-50 text-rose-800'
                }`}
              >
                {bookingMessage.type === 'success' && (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                )}
                <span>{bookingMessage.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!selectedLeadId || !selectedSlot || confirming}
              className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {confirming
                ? 'Confirming in Database...'
                : selectedSlot
                ? `Confirm Booking (${selectedDate} ${selectedSlot})`
                : 'Select a Time Slot'}
            </button>
          </form>
        </Card>

        {/* Scheduled Appointments List */}
        <div className="lg:col-span-2">
          {error ? (
            <EmptyState
              icon={CalendarClock}
              tone="warning"
              title="Scheduling database unreachable"
              description={error}
            />
          ) : appointments.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="No appointments scheduled"
              description="Confirmed demos booked by prospects or through the scheduling form will appear here."
            />
          ) : (
            <Card padding="none" className="overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-base font-semibold text-slate-900">
                  Confirmed & Historical Appointments ({appointments.length})
                </h2>
              </div>
              <div className="divide-y divide-slate-100">
                {appointments.map((appt) => (
                  <div
                    key={appt.id}
                    className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {appt.lead_name || `Lead #${appt.lead_id}`}
                        {appt.company ? ` · ${appt.company}` : ''}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {appt.topic || 'Product Consultation & Demo'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right font-mono text-xs text-slate-700">
                        <p className="font-semibold">{appt.scheduled_date}</p>
                        <p className="text-slate-500">{appt.scheduled_time}</p>
                      </div>
                      <AppointmentStatusBadge status={appt.status} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
