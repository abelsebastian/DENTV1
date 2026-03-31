const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const prisma = new PrismaClient();
router.use(authenticate);

// KPI endpoint - total patients, revenue, appointments
router.get('/kpi', async (req, res) => {
  try {
    const [totalPatients, totalAppointments, revenueResult] = await Promise.all([
      prisma.patient.count(),
      prisma.appointment.count(),
      prisma.payment.aggregate({
        where: { status: 'PAID' },
        _sum: { amount: true },
      }),
    ]);

    res.json({
      totalPatients,
      totalRevenue: revenueResult._sum.amount || 0,
      totalAppointments,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Chair utilization endpoint
// Formula: (sum of completed appointment durations / total available chair minutes) * 100
// Clinic hours: 9AM–5PM = 480 min/day. Query range defaults to current month.
router.get('/chair-utilization', async (req, res) => {
  try {
    const CLINIC_OPEN_MINUTES = 480; // 8 hours per day

    // Default to current month
    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Count working days in the month (Mon–Sat, exclude Sun)
    let workingDays = 0;
    const cursor = new Date(monthStart);
    while (cursor <= monthEnd) {
      if (cursor.getDay() !== 0) workingDays++; // exclude Sunday
      cursor.setDate(cursor.getDate() + 1);
    }

    // Get number of active chairs (distinct chair values used this month)
    const chairs = await prisma.appointment.findMany({
      where: { scheduledAt: { gte: monthStart, lte: monthEnd }, chair: { not: null } },
      select: { chair: true },
      distinct: ['chair'],
    });
    const numChairs = Math.max(chairs.length, 1); // at least 1 chair

    const totalAvailableMinutes = CLINIC_OPEN_MINUTES * workingDays * numChairs;

    // Sum durations of COMPLETED appointments this month
    const completed = await prisma.appointment.aggregate({
      where: {
        scheduledAt: { gte: monthStart, lte: monthEnd },
        status: 'COMPLETED',
      },
      _sum: { duration: true },
      _count: true,
    });

    const usedMinutes = completed._sum.duration || 0;
    const utilizationRate = totalAvailableMinutes > 0
      ? parseFloat(((usedMinutes / totalAvailableMinutes) * 100).toFixed(1))
      : 0;

    // Status label
    let status = 'LOW';
    if (utilizationRate >= 80) status = 'HIGH';
    else if (utilizationRate >= 60) status = 'OPTIMAL';

    res.json({
      utilizationRate,
      usedMinutes,
      totalAvailableMinutes,
      workingDays,
      numChairs,
      completedAppointments: completed._count,
      status, // LOW | OPTIMAL | HIGH
      period: { from: monthStart, to: monthEnd },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// No-show rate endpoint
router.get('/no-show-rate', async (req, res) => {
  try {
    const [totalAppointments, noShowAppointments] = await Promise.all([
      prisma.appointment.count(),
      prisma.appointment.count({ where: { status: 'NO_SHOW' } }),
    ]);

    const noShowRate = totalAppointments > 0 
      ? parseFloat(((noShowAppointments / totalAppointments) * 100).toFixed(2))
      : 0;

    res.json({
      totalAppointments,
      noShowAppointments,
      noShowRate,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Provider performance endpoint
router.get('/provider-performance', async (req, res) => {
  try {
    const providers = await prisma.provider.findMany({
      where: { isActive: true },
    });

    const performance = await Promise.all(
      providers.map(async (provider) => {
        const [totalAppointments, uniquePatients] = await Promise.all([
          prisma.appointment.count({ where: { providerId: provider.id } }),
          prisma.appointment.findMany({
            where: { providerId: provider.id },
            select: { patientId: true },
            distinct: ['patientId'],
          }),
        ]);

        return {
          providerId: provider.id,
          providerName: provider.name,
          specialty: provider.specialty,
          totalAppointments,
          patientsHandled: uniquePatients.length,
        };
      })
    );

    res.json(performance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/dashboard', async (req, res) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalPatients,
      todayAppointments,
      monthAppointments,
      noShows,
      totalRevenue,
      pendingPayments,
      treatments,
    ] = await Promise.all([
      prisma.patient.count(),
      prisma.appointment.count({ where: { scheduledAt: { gte: today, lte: todayEnd } } }),
      prisma.appointment.count({ where: { scheduledAt: { gte: monthStart } } }),
      prisma.appointment.count({ where: { status: 'NO_SHOW', scheduledAt: { gte: monthStart } } }),
      prisma.payment.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { status: { in: ['PENDING', 'OVERDUE'] } }, _sum: { amount: true } }),
      prisma.treatment.groupBy({ by: ['status'], _count: true }),
    ]);

    const completedAppts = await prisma.appointment.count({ where: { status: 'COMPLETED', scheduledAt: { gte: monthStart } } });
    const noShowRate = monthAppointments > 0 ? ((noShows / monthAppointments) * 100).toFixed(1) : 0;
    const utilizationRate = monthAppointments > 0 ? ((completedAppts / monthAppointments) * 100).toFixed(1) : 0;

    const accepted = treatments.find((t) => t.status === 'ACCEPTED')?._count || 0;
    const totalTreatments = treatments.reduce((s, t) => s + t._count, 0);
    const acceptanceRate = totalTreatments > 0 ? ((accepted / totalTreatments) * 100).toFixed(1) : 0;

    res.json({
      totalPatients,
      todayAppointments,
      monthAppointments,
      noShowRate: parseFloat(noShowRate),
      utilizationRate: parseFloat(utilizationRate),
      totalRevenue: totalRevenue._sum.amount || 0,
      pendingPayments: pendingPayments._sum.amount || 0,
      acceptanceRate: parseFloat(acceptanceRate),
      treatmentBreakdown: treatments,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/revenue', async (req, res) => {
  try {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const result = await prisma.payment.aggregate({
        where: { status: 'PAID', paidAt: { gte: start, lte: end } },
        _sum: { amount: true },
      });
      months.push({
        month: start.toLocaleString('default', { month: 'short' }),
        revenue: result._sum.amount || 0,
      });
    }
    res.json(months);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/appointments-trend', async (req, res) => {
  try {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const end = new Date(d); end.setHours(23, 59, 59, 999);
      const [total, noShow] = await Promise.all([
        prisma.appointment.count({ where: { scheduledAt: { gte: d, lte: end } } }),
        prisma.appointment.count({ where: { scheduledAt: { gte: d, lte: end }, status: 'NO_SHOW' } }),
      ]);
      days.push({ day: d.toLocaleDateString('default', { weekday: 'short' }), total, noShow });
    }
    res.json(days);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Provider productivity
router.get('/providers', async (req, res) => {
  try {
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

    const providers = await prisma.provider.findMany({ where: { isActive: true } });
    const result = await Promise.all(providers.map(async (p) => {
      const [total, completed, noShows] = await Promise.all([
        prisma.appointment.count({ where: { providerId: p.id, scheduledAt: { gte: monthStart } } }),
        prisma.appointment.count({ where: { providerId: p.id, status: 'COMPLETED', scheduledAt: { gte: monthStart } } }),
        prisma.appointment.count({ where: { providerId: p.id, status: 'NO_SHOW', scheduledAt: { gte: monthStart } } }),
      ]);
      return {
        id: p.id, name: p.name, specialty: p.specialty,
        total, completed, noShows,
        utilizationRate: total > 0 ? parseFloat(((completed / total) * 100).toFixed(1)) : 0,
      };
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Alerts: overdue payments + pending follow-ups + high no-show appointments today
router.get('/alerts', async (req, res) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const [overduePayments, pendingFollowUps, highRiskToday] = await Promise.all([
      prisma.payment.findMany({
        where: { status: 'OVERDUE' },
        include: { patient: true },
        orderBy: { dueDate: 'asc' },
        take: 10,
      }),
      prisma.treatment.findMany({
        where: { followUpDate: { lte: todayEnd }, status: { in: ['PENDING', 'ACCEPTED'] } },
        include: { patient: true },
        orderBy: { followUpDate: 'asc' },
        take: 10,
      }),
      prisma.appointment.findMany({
        where: { scheduledAt: { gte: today, lte: todayEnd }, noShowProbability: { gte: 0.4 }, status: { in: ['SCHEDULED', 'CONFIRMED'] } },
        include: { patient: true, provider: true },
        orderBy: { noShowProbability: 'desc' },
      }),
    ]);

    res.json({
      overduePayments: overduePayments.map((p) => ({
        id: p.id, type: 'OVERDUE_PAYMENT',
        message: `$${p.amount.toLocaleString()} overdue from ${p.patient.firstName} ${p.patient.lastName}`,
        dueDate: p.dueDate, patientId: p.patientId, severity: 'high',
      })),
      pendingFollowUps: pendingFollowUps.map((t) => ({
        id: t.id, type: 'FOLLOW_UP',
        message: `Follow-up due: ${t.title} — ${t.patient.firstName} ${t.patient.lastName}`,
        followUpDate: t.followUpDate, patientId: t.patientId, severity: 'medium',
      })),
      highRiskToday: highRiskToday.map((a) => ({
        id: a.id, type: 'NO_SHOW_RISK',
        message: `${Math.round(a.noShowProbability * 100)}% no-show risk — ${a.patient.firstName} ${a.patient.lastName} at ${new Date(a.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        scheduledAt: a.scheduledAt, patientId: a.patientId, severity: a.noShowProbability > 0.6 ? 'high' : 'medium',
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
