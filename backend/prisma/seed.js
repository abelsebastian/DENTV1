const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function setTime(date, h, m = 0) {
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

async function main() {
  const password = await bcrypt.hash('password123', 10);

  // ── Users ──────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@dentalops.com' },
    update: {},
    create: { name: 'Admin User', email: 'admin@dentalops.com', password, role: 'ADMIN' },
  });
  const dentist1User = await prisma.user.upsert({
    where: { email: 'dr.smith@dentalops.com' },
    update: {},
    create: { name: 'Dr. Sarah Smith', email: 'dr.smith@dentalops.com', password, role: 'DENTIST' },
  });
  const dentist2User = await prisma.user.upsert({
    where: { email: 'dr.jones@dentalops.com' },
    update: {},
    create: { name: 'Dr. Michael Jones', email: 'dr.jones@dentalops.com', password, role: 'DENTIST' },
  });
  await prisma.user.upsert({
    where: { email: 'staff@dentalops.com' },
    update: {},
    create: { name: 'Reception Staff', email: 'staff@dentalops.com', password, role: 'STAFF' },
  });

  // ── Providers ──────────────────────────────────────────
  const p1 = await prisma.provider.upsert({
    where: { id: 'provider-1' },
    update: {},
    create: { id: 'provider-1', name: 'Dr. Sarah Smith', specialty: 'General Dentistry', email: 'dr.smith@dentalops.com', phone: '555-0201' },
  });
  const p2 = await prisma.provider.upsert({
    where: { id: 'provider-2' },
    update: {},
    create: { id: 'provider-2', name: 'Dr. Michael Jones', specialty: 'Orthodontics', email: 'dr.jones@dentalops.com', phone: '555-0202' },
  });
  const p3 = await prisma.provider.upsert({
    where: { id: 'provider-3' },
    update: {},
    create: { id: 'provider-3', name: 'Dr. Emily Chen', specialty: 'Periodontics', email: 'dr.chen@dentalops.com', phone: '555-0203' },
  });

  // ── Patients ───────────────────────────────────────────
  const patients = [
    { id: 'pat-1', firstName: 'John', lastName: 'Doe', phone: '555-0101', email: 'john.doe@email.com', dob: '1985-06-15', gender: 'Male', noShowCount: 1, totalAppointments: 8, medical: 'No known allergies', dental: 'Regular cleanings, crown on #14' },
    { id: 'pat-2', firstName: 'Sarah', lastName: 'Johnson', phone: '555-0102', email: 'sarah.j@email.com', dob: '1990-03-22', gender: 'Female', noShowCount: 0, totalAppointments: 12, medical: 'Penicillin allergy', dental: 'Braces completed 2019' },
    { id: 'pat-3', firstName: 'Michael', lastName: 'Brown', phone: '555-0103', email: 'mbrown@email.com', dob: '1978-11-08', gender: 'Male', noShowCount: 3, totalAppointments: 10, medical: 'Hypertension, blood thinners', dental: 'Multiple fillings, gum disease history' },
    { id: 'pat-4', firstName: 'Emily', lastName: 'Davis', phone: '555-0104', email: 'emily.d@email.com', dob: '1995-07-30', gender: 'Female', noShowCount: 0, totalAppointments: 5, medical: 'None', dental: 'Wisdom teeth removed 2021' },
    { id: 'pat-5', firstName: 'Robert', lastName: 'Wilson', phone: '555-0105', email: 'rwilson@email.com', dob: '1965-02-14', gender: 'Male', noShowCount: 2, totalAppointments: 15, medical: 'Diabetes Type 2', dental: 'Implant on #30, partial denture' },
    { id: 'pat-6', firstName: 'Jennifer', lastName: 'Martinez', phone: '555-0106', email: 'jmartinez@email.com', dob: '1988-09-05', gender: 'Female', noShowCount: 0, totalAppointments: 7, medical: 'Asthma', dental: 'Invisalign in progress' },
    { id: 'pat-7', firstName: 'David', lastName: 'Taylor', phone: '555-0107', email: 'dtaylor@email.com', dob: '1972-04-18', gender: 'Male', noShowCount: 4, totalAppointments: 9, medical: 'Heart condition, aspirin daily', dental: 'Bridge on #18-20' },
    { id: 'pat-8', firstName: 'Lisa', lastName: 'Anderson', phone: '555-0108', email: 'landerson@email.com', dob: '1993-12-01', gender: 'Female', noShowCount: 0, totalAppointments: 3, medical: 'None', dental: 'New patient, first visit' },
    { id: 'pat-9', firstName: 'James', lastName: 'Thomas', phone: '555-0109', email: 'jthomas@email.com', dob: '1980-08-25', gender: 'Male', noShowCount: 1, totalAppointments: 6, medical: 'Latex allergy', dental: 'Root canal #19 completed' },
    { id: 'pat-10', firstName: 'Amanda', lastName: 'Jackson', phone: '555-0110', email: 'ajackson@email.com', dob: '1997-01-17', gender: 'Female', noShowCount: 0, totalAppointments: 4, medical: 'None', dental: 'Whitening treatment ongoing' },
  ];

  const createdPatients = {};
  for (const p of patients) {
    const pat = await prisma.patient.upsert({
      where: { id: p.id },
      update: { noShowCount: p.noShowCount, totalAppointments: p.totalAppointments },
      create: {
        id: p.id, firstName: p.firstName, lastName: p.lastName,
        phone: p.phone, email: p.email,
        dateOfBirth: new Date(p.dob), gender: p.gender,
        medicalHistory: p.medical, dentalHistory: p.dental,
        noShowCount: p.noShowCount, totalAppointments: p.totalAppointments,
      },
    });
    createdPatients[p.id] = pat;
  }

  // ── Appointments (past + today + future) ───────────────
  const appts = [
    // Past completed
    { id: 'appt-1', patientId: 'pat-1', providerId: 'provider-1', procedure: 'Routine Cleaning', scheduledAt: setTime(daysAgo(30), 9), duration: 60, status: 'COMPLETED', chair: 'Chair 1', noShowProbability: 0.18 },
    { id: 'appt-2', patientId: 'pat-2', providerId: 'provider-1', procedure: 'Cavity Filling', scheduledAt: setTime(daysAgo(28), 10), duration: 45, status: 'COMPLETED', chair: 'Chair 2', noShowProbability: 0.10 },
    { id: 'appt-3', patientId: 'pat-3', providerId: 'provider-2', procedure: 'Orthodontic Adjustment', scheduledAt: setTime(daysAgo(25), 14), duration: 30, status: 'NO_SHOW', chair: 'Chair 3', noShowProbability: 0.52 },
    { id: 'appt-4', patientId: 'pat-4', providerId: 'provider-1', procedure: 'Teeth Whitening', scheduledAt: setTime(daysAgo(22), 11), duration: 90, status: 'COMPLETED', chair: 'Chair 1', noShowProbability: 0.10 },
    { id: 'appt-5', patientId: 'pat-5', providerId: 'provider-3', procedure: 'Periodontal Scaling', scheduledAt: setTime(daysAgo(20), 9, 30), duration: 60, status: 'COMPLETED', chair: 'Chair 2', noShowProbability: 0.38 },
    { id: 'appt-6', patientId: 'pat-6', providerId: 'provider-2', procedure: 'Invisalign Check', scheduledAt: setTime(daysAgo(18), 15), duration: 30, status: 'COMPLETED', chair: 'Chair 3', noShowProbability: 0.10 },
    { id: 'appt-7', patientId: 'pat-7', providerId: 'provider-1', procedure: 'Crown Preparation', scheduledAt: setTime(daysAgo(15), 10), duration: 120, status: 'NO_SHOW', chair: 'Chair 1', noShowProbability: 0.58 },
    { id: 'appt-8', patientId: 'pat-8', providerId: 'provider-1', procedure: 'New Patient Exam', scheduledAt: setTime(daysAgo(12), 9), duration: 60, status: 'COMPLETED', chair: 'Chair 2', noShowProbability: 0.10 },
    { id: 'appt-9', patientId: 'pat-9', providerId: 'provider-3', procedure: 'Root Canal Follow-up', scheduledAt: setTime(daysAgo(10), 13), duration: 45, status: 'COMPLETED', chair: 'Chair 1', noShowProbability: 0.18 },
    { id: 'appt-10', patientId: 'pat-10', providerId: 'provider-1', procedure: 'Whitening Session', scheduledAt: setTime(daysAgo(8), 11), duration: 60, status: 'COMPLETED', chair: 'Chair 3', noShowProbability: 0.10 },
    { id: 'appt-11', patientId: 'pat-1', providerId: 'provider-2', procedure: 'X-Ray & Exam', scheduledAt: setTime(daysAgo(6), 14), duration: 45, status: 'COMPLETED', chair: 'Chair 2', noShowProbability: 0.18 },
    { id: 'appt-12', patientId: 'pat-3', providerId: 'provider-3', procedure: 'Deep Cleaning', scheduledAt: setTime(daysAgo(5), 10), duration: 90, status: 'COMPLETED', chair: 'Chair 1', noShowProbability: 0.52 },
    { id: 'appt-13', patientId: 'pat-5', providerId: 'provider-1', procedure: 'Implant Check', scheduledAt: setTime(daysAgo(3), 9), duration: 30, status: 'CANCELLED', chair: 'Chair 2', noShowProbability: 0.38 },
    { id: 'appt-14', patientId: 'pat-2', providerId: 'provider-2', procedure: 'Retainer Fitting', scheduledAt: setTime(daysAgo(2), 15), duration: 45, status: 'COMPLETED', chair: 'Chair 3', noShowProbability: 0.10 },
    { id: 'appt-15', patientId: 'pat-4', providerId: 'provider-1', procedure: 'Routine Cleaning', scheduledAt: setTime(daysAgo(1), 11), duration: 60, status: 'COMPLETED', chair: 'Chair 1', noShowProbability: 0.10 },
    // Today
    { id: 'appt-16', patientId: 'pat-6', providerId: 'provider-1', procedure: 'Invisalign Progress', scheduledAt: setTime(new Date(), 9), duration: 30, status: 'CONFIRMED', chair: 'Chair 2', noShowProbability: 0.10 },
    { id: 'appt-17', patientId: 'pat-7', providerId: 'provider-2', procedure: 'Bridge Adjustment', scheduledAt: setTime(new Date(), 10, 30), duration: 60, status: 'SCHEDULED', chair: 'Chair 3', noShowProbability: 0.58 },
    { id: 'appt-18', patientId: 'pat-9', providerId: 'provider-3', procedure: 'Gum Treatment', scheduledAt: setTime(new Date(), 13), duration: 45, status: 'SCHEDULED', chair: 'Chair 1', noShowProbability: 0.18 },
    { id: 'appt-19', patientId: 'pat-10', providerId: 'provider-1', procedure: 'Whitening Session 2', scheduledAt: setTime(new Date(), 14, 30), duration: 60, status: 'SCHEDULED', chair: 'Chair 2', noShowProbability: 0.10 },
    { id: 'appt-20', patientId: 'pat-3', providerId: 'provider-2', procedure: 'Orthodontic Consult', scheduledAt: setTime(new Date(), 16), duration: 30, status: 'SCHEDULED', chair: 'Chair 3', noShowProbability: 0.52, isEmergency: false },
    // Future
    { id: 'appt-21', patientId: 'pat-1', providerId: 'provider-1', procedure: 'Crown Fitting', scheduledAt: setTime(daysFromNow(2), 10), duration: 90, status: 'SCHEDULED', chair: 'Chair 1', noShowProbability: 0.18 },
    { id: 'appt-22', patientId: 'pat-8', providerId: 'provider-3', procedure: 'Periodontal Exam', scheduledAt: setTime(daysFromNow(3), 9), duration: 60, status: 'CONFIRMED', chair: 'Chair 2', noShowProbability: 0.10 },
    { id: 'appt-23', patientId: 'pat-5', providerId: 'provider-1', procedure: 'Implant Review', scheduledAt: setTime(daysFromNow(5), 14), duration: 45, status: 'SCHEDULED', chair: 'Chair 3', noShowProbability: 0.38 },
    { id: 'appt-24', patientId: 'pat-2', providerId: 'provider-2', procedure: 'Orthodontic Adjustment', scheduledAt: setTime(daysFromNow(7), 11), duration: 30, status: 'SCHEDULED', chair: 'Chair 1', noShowProbability: 0.10 },
    { id: 'appt-25', patientId: 'pat-7', providerId: 'provider-1', procedure: 'Emergency Extraction', scheduledAt: setTime(daysFromNow(1), 8), duration: 60, status: 'CONFIRMED', chair: 'Chair 2', noShowProbability: 0.58, isEmergency: true },
  ];

  for (const a of appts) {
    await prisma.appointment.upsert({
      where: { id: a.id },
      update: { status: a.status },
      create: {
        id: a.id, patientId: a.patientId, providerId: a.providerId,
        procedure: a.procedure, scheduledAt: a.scheduledAt,
        duration: a.duration, status: a.status, chair: a.chair,
        noShowProbability: a.noShowProbability,
        isEmergency: a.isEmergency || false,
      },
    });
  }

  // ── Treatments ─────────────────────────────────────────
  const treatments = [
    { id: 'tx-1', patientId: 'pat-1', title: 'Full Crown Restoration #14', description: 'Porcelain crown for cracked molar', estimatedCost: 1800, acceptanceProbability: 0.60, status: 'ACCEPTED', consentSigned: true },
    { id: 'tx-2', patientId: 'pat-2', title: 'Invisalign Full Treatment', description: '18-month clear aligner program', estimatedCost: 4500, acceptanceProbability: 0.50, status: 'IN_PROGRESS', consentSigned: true },
    { id: 'tx-3', patientId: 'pat-3', title: 'Full Mouth Periodontal Treatment', description: 'Deep scaling and root planing all quadrants', estimatedCost: 2200, acceptanceProbability: 0.50, status: 'PENDING', consentSigned: false },
    { id: 'tx-4', patientId: 'pat-4', title: 'Professional Whitening Package', description: 'In-office + take-home whitening', estimatedCost: 650, acceptanceProbability: 0.70, status: 'ACCEPTED', consentSigned: true },
    { id: 'tx-5', patientId: 'pat-5', title: 'Dental Implant #30', description: 'Titanium implant with porcelain crown', estimatedCost: 3800, acceptanceProbability: 0.50, status: 'COMPLETED', consentSigned: true },
    { id: 'tx-6', patientId: 'pat-6', title: 'Invisalign Lite', description: '6-month minor correction program', estimatedCost: 2800, acceptanceProbability: 0.60, status: 'IN_PROGRESS', consentSigned: true },
    { id: 'tx-7', patientId: 'pat-7', title: 'Three-Unit Bridge #18-20', description: 'Porcelain-fused-to-metal bridge', estimatedCost: 3200, acceptanceProbability: 0.50, status: 'COMPLETED', consentSigned: true },
    { id: 'tx-8', patientId: 'pat-8', title: 'Comprehensive Exam & X-Rays', description: 'Full mouth series + panoramic', estimatedCost: 350, acceptanceProbability: 0.70, status: 'COMPLETED', consentSigned: true },
    { id: 'tx-9', patientId: 'pat-9', title: 'Root Canal Therapy #19', description: 'Endodontic treatment with buildup', estimatedCost: 1400, acceptanceProbability: 0.60, status: 'COMPLETED', consentSigned: true },
    { id: 'tx-10', patientId: 'pat-10', title: 'Zoom Whitening', description: 'In-office power whitening', estimatedCost: 500, acceptanceProbability: 0.70, status: 'ACCEPTED', consentSigned: true },
    { id: 'tx-11', patientId: 'pat-1', title: 'Night Guard Fabrication', description: 'Custom occlusal guard for bruxism', estimatedCost: 450, acceptanceProbability: 0.60, status: 'PENDING', consentSigned: false },
    { id: 'tx-12', patientId: 'pat-3', title: 'Extraction #17', description: 'Surgical extraction impacted wisdom tooth', estimatedCost: 380, acceptanceProbability: 0.50, status: 'DECLINED', consentSigned: false },
  ];

  for (const t of treatments) {
    await prisma.treatment.upsert({
      where: { id: t.id },
      update: {},
      create: {
        id: t.id, patientId: t.patientId, title: t.title,
        description: t.description, estimatedCost: t.estimatedCost,
        acceptanceProbability: t.acceptanceProbability, status: t.status,
        consentSigned: t.consentSigned,
        followUpDate: t.status === 'PENDING' ? daysFromNow(7) : null,
      },
    });
  }

  // ── Payments ───────────────────────────────────────────
  const payments = [
    { id: 'pay-1', patientId: 'pat-1', treatmentId: 'tx-1', amount: 900, status: 'PAID', method: 'Card', paidAt: daysAgo(20) },
    { id: 'pay-2', patientId: 'pat-1', treatmentId: 'tx-1', amount: 900, status: 'PENDING', method: 'Insurance', dueDate: daysFromNow(14) },
    { id: 'pay-3', patientId: 'pat-2', treatmentId: 'tx-2', amount: 1500, status: 'PAID', method: 'Card', paidAt: daysAgo(60) },
    { id: 'pay-4', patientId: 'pat-2', treatmentId: 'tx-2', amount: 1500, status: 'PAID', method: 'Card', paidAt: daysAgo(30) },
    { id: 'pay-5', patientId: 'pat-2', treatmentId: 'tx-2', amount: 1500, status: 'PENDING', method: 'Payment Plan', dueDate: daysFromNow(30) },
    { id: 'pay-6', patientId: 'pat-4', treatmentId: 'tx-4', amount: 650, status: 'PAID', method: 'Cash', paidAt: daysAgo(22) },
    { id: 'pay-7', patientId: 'pat-5', treatmentId: 'tx-5', amount: 2000, status: 'PAID', method: 'Insurance', paidAt: daysAgo(45) },
    { id: 'pay-8', patientId: 'pat-5', treatmentId: 'tx-5', amount: 1800, status: 'PAID', method: 'Card', paidAt: daysAgo(15) },
    { id: 'pay-9', patientId: 'pat-7', treatmentId: 'tx-7', amount: 1600, status: 'PAID', method: 'Insurance', paidAt: daysAgo(50) },
    { id: 'pay-10', patientId: 'pat-7', treatmentId: 'tx-7', amount: 1600, status: 'PAID', method: 'Card', paidAt: daysAgo(25) },
    { id: 'pay-11', patientId: 'pat-8', treatmentId: 'tx-8', amount: 350, status: 'PAID', method: 'Cash', paidAt: daysAgo(12) },
    { id: 'pay-12', patientId: 'pat-9', treatmentId: 'tx-9', amount: 700, status: 'PAID', method: 'Card', paidAt: daysAgo(10) },
    { id: 'pay-13', patientId: 'pat-9', treatmentId: 'tx-9', amount: 700, status: 'PAID', method: 'Insurance', paidAt: daysAgo(5) },
    { id: 'pay-14', patientId: 'pat-10', treatmentId: 'tx-10', amount: 500, status: 'PAID', method: 'Card', paidAt: daysAgo(8) },
    { id: 'pay-15', patientId: 'pat-3', treatmentId: 'tx-3', amount: 2200, status: 'OVERDUE', method: 'Insurance', dueDate: daysAgo(10) },
    { id: 'pay-16', patientId: 'pat-6', treatmentId: 'tx-6', amount: 1400, status: 'PAID', method: 'Card', paidAt: daysAgo(35) },
    { id: 'pay-17', patientId: 'pat-6', treatmentId: 'tx-6', amount: 1400, status: 'PENDING', method: 'Payment Plan', dueDate: daysFromNow(20) },
    { id: 'pay-18', patientId: 'pat-1', treatmentId: 'tx-11', amount: 450, status: 'PENDING', method: null, dueDate: daysFromNow(7) },
  ];

  for (const p of payments) {
    await prisma.payment.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id, patientId: p.patientId, treatmentId: p.treatmentId,
        amount: p.amount, status: p.status, method: p.method || null,
        paidAt: p.paidAt || null, dueDate: p.dueDate || null,
      },
    });
  }

  // ── Communications ─────────────────────────────────────
  const comms = [
    { patientId: 'pat-1', channel: 'Phone', direction: 'INBOUND', message: 'Called to confirm appointment for crown fitting next week. Very happy with the treatment plan.', sentiment: 'POSITIVE', intent: 'BOOKING' },
    { patientId: 'pat-3', channel: 'SMS', direction: 'INBOUND', message: 'I need to cancel my appointment, I have a problem with the payment.', sentiment: 'NEGATIVE', intent: 'CANCELLATION' },
    { patientId: 'pat-7', channel: 'Phone', direction: 'INBOUND', message: 'I have urgent pain in my tooth, need emergency appointment as soon as possible.', sentiment: 'NEGATIVE', intent: 'EMERGENCY' },
    { patientId: 'pat-2', channel: 'Email', direction: 'INBOUND', message: 'Thank you for the great service! My teeth look excellent after the whitening.', sentiment: 'POSITIVE', intent: 'GENERAL' },
    { patientId: 'pat-5', channel: 'Phone', direction: 'OUTBOUND', message: 'Called patient to remind about upcoming implant review appointment.', sentiment: 'NEUTRAL', intent: 'BOOKING' },
    { patientId: 'pat-8', channel: 'SMS', direction: 'OUTBOUND', message: 'Reminder: Your appointment is tomorrow at 9:00 AM. Please confirm.', sentiment: 'NEUTRAL', intent: 'BOOKING' },
    { patientId: 'pat-10', channel: 'In-Person', direction: 'INBOUND', message: 'Patient came in asking about payment plan options for whitening treatment.', sentiment: 'NEUTRAL', intent: 'BILLING' },
    { patientId: 'pat-6', channel: 'Email', direction: 'INBOUND', message: 'Happy with the Invisalign progress! Can we schedule the next check sooner?', sentiment: 'POSITIVE', intent: 'BOOKING' },
    { patientId: 'pat-9', channel: 'Phone', direction: 'INBOUND', message: 'The root canal area still hurts a bit. Is this normal? Should I come in?', sentiment: 'NEGATIVE', intent: 'GENERAL' },
    { patientId: 'pat-4', channel: 'SMS', direction: 'INBOUND', message: 'Thanks for the whitening session, results are great!', sentiment: 'POSITIVE', intent: 'GENERAL' },
  ];

  for (const c of comms) {
    await prisma.communication.create({ data: c }).catch(() => {});
  }

  // ── Audit Logs ─────────────────────────────────────────
  await prisma.auditLog.create({ data: { userId: admin.id, action: 'LOGIN', entity: 'User', entityId: admin.id, details: 'Admin login' } }).catch(() => {});
  await prisma.auditLog.create({ data: { userId: dentist1User.id, action: 'CREATE', entity: 'Appointment', entityId: 'appt-16', details: 'Booked Invisalign Progress for Jennifer Martinez' } }).catch(() => {});
  await prisma.auditLog.create({ data: { userId: dentist2User.id, action: 'UPDATE', entity: 'Treatment', entityId: 'tx-2', details: 'Updated Invisalign treatment status to IN_PROGRESS' } }).catch(() => {});

  console.log('✅ Seed complete:', {
    users: 4, providers: 3, patients: patients.length,
    appointments: appts.length, treatments: treatments.length,
    payments: payments.length, communications: comms.length,
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
