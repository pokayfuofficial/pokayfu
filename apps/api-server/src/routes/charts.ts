import { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth';
import { getChart } from '../services/charts.service';


export async function chartRoutes(fastify: FastifyInstance) {

  // GET /charts/hot
  fastify.get('/charts/hot', async (request, reply) => {
    const { region = 'RU', period = '24h' } = request.query as any;
    const data = await getChart(ChartType.HOT, region as Region, period as Period);
    return reply.send({ success: true, data });
  });

  // GET /charts/rising
  fastify.get('/charts/rising', async (request, reply) => {
    const { region = 'RU', period = '24h' } = request.query as any;
    const data = await getChart(ChartType.RISING, region as Region, period as Period);
    return reply.send({ success: true, data });
  });

  // GET /charts/holders
  fastify.get('/charts/holders', async (request, reply) => {
    const { region = 'RU', period = '24h' } = request.query as any;
    const data = await getChart(ChartType.HOLDERS, region as Region, period as Period);
    return reply.send({ success: true, data });
  });

  // GET /charts/new
  fastify.get('/charts/new', async (request, reply) => {
    const { region = 'RU' } = request.query as any;
    const data = await getChart(ChartType.NEW, region as Region, Period.WEEK);
    return reply.send({ success: true, data });
  });

  // GET /charts/volume
  fastify.get('/charts/volume', async (request, reply) => {
    const { region = 'RU', period = '24h' } = request.query as any;
    const data = await getChart(ChartType.VOLUME, region as Region, period as Period);
    return reply.send({ success: true, data });
  });

  // GET /charts/genre/:genre
  fastify.get('/charts/genre/:genre', async (request, reply) => {
    const { genre } = request.params as { genre: string };
    const { region = 'RU', period = '24h' } = request.query as any;
    const data = await getChart(ChartType.GENRE, region as Region, period as Period, genre.toUpperCase());
    return reply.send({ success: true, data });
  });

  // GET /charts/for-you — персональные рекомендации
  fastify.get('/charts/for-you', { preHandler: requireAuth }, async (request, reply) => {
    const payload = request.user as { userId: string };
    const data = await getChart(ChartType.FOR_YOU, Region.RU, Period.WEEK, undefined, payload.userId);
    return reply.send({ success: true, data });
  });

  // GET /charts/region — по регионам
  fastify.get('/charts/region', async (request, reply) => {
    const { region = 'RU', type = 'hot', period = '24h' } = request.query as any;
    const chartType = (type.toUpperCase() as ChartType) || ChartType.HOT;
    const data = await getChart(chartType, region as Region, period as Period);
    return reply.send({ success: true, data });
  });
}
