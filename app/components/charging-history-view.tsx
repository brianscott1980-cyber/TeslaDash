'use client';
import {useState} from 'react';
import {
  Download,
  PlugZap,
  Zap,
  Gauge,
  Clock,
  Home,
  BatteryCharging
} from 'lucide-react';
import {
  filterCharges,
  classifyCharge,
  type ChargingHistory,
  type HistoricalCharge,
  type ChargerCategory
} from '../../lib/charging-history-model';
import type {Dashboard} from '../../lib/data';
import {ChargingTimeline} from './charging-timeline';

const money = (value: number) =>
  new Intl.NumberFormat('en-GB', {style: 'currency', currency: 'GBP'}).format(value);

const stamp = (value: string) =>
  new Date(value).toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

export function CategoryBadge({category}: {category: ChargerCategory}) {
  if (category === 'Supercharger') {
    return (
      <span className="charger-pill pill-supercharger">
        <Zap size={11} fill="currentColor"/>Supercharger
      </span>
    );
  }
  if (category === 'Fast public') {
    return (
      <span className="charger-pill pill-fast">
        <Gauge size={11}/>Fast public
      </span>
    );
  }
  if (category === 'Slow public') {
    return (
      <span className="charger-pill pill-slow">
        <BatteryCharging size={11}/>Slow public
      </span>
    );
  }
  return (
    <span className="charger-pill pill-home">
      <Home size={11}/>Home
    </span>
  );
}

export function ChargingHistoryView({
  history,
  period,
  data,
  onEstimates
}: {
  history: ChargingHistory | null;
  period: string;
  data?: Dashboard | null;
  now?: number;
  onEstimates?: () => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState<'All' | ChargerCategory>('All');

  const sourceSessions: HistoricalCharge[] = (data?.demo && (!history || !history.sessions.length))
    ? (data.sessions || []).map((s, idx) => ({
        id: `demo-${idx}`,
        start: s.start ?? (s.date.includes('23 Oct') ? '2026-10-23T00:30:00Z' : s.date.includes('21 Oct') ? '2026-10-21T23:30:00Z' : s.date.includes('19 Oct') ? '2026-10-19T14:12:00Z' : s.date.includes('17 Oct') ? '2026-10-17T11:20:00Z' : '2026-10-15T14:10:00Z'),
        end: s.end ?? (s.date.includes('23 Oct') ? '2026-10-23T04:30:00Z' : s.date.includes('21 Oct') ? '2026-10-22T05:00:00Z' : s.date.includes('19 Oct') ? '2026-10-19T14:50:00Z' : s.date.includes('17 Oct') ? '2026-10-17T12:05:00Z' : '2026-10-15T16:10:00Z'),
        kwh: s.kwh,
        cost: s.cost,
        costBasis: (s.costBasis as any) ?? 'estimated',
        type: s.type,
        location: s.location,
        category: (s.category as ChargerCategory) ?? classifyCharge(s)
      }))
    : (history?.sessions ?? []).map(s => ({
        ...s,
        category: s.category ?? classifyCharge(s)
      }));

  const allFilteredSessions = filterCharges(sourceSessions, period);

  const counts: Record<'All' | ChargerCategory, number> = {
    All: allFilteredSessions.length,
    Home: allFilteredSessions.filter(s => s.category === 'Home').length,
    Supercharger: allFilteredSessions.filter(s => s.category === 'Supercharger').length,
    'Fast public': allFilteredSessions.filter(s => s.category === 'Fast public').length,
    'Slow public': allFilteredSessions.filter(s => s.category === 'Slow public').length
  };

  const sessions = selectedCategory === 'All'
    ? allFilteredSessions
    : allFilteredSessions.filter(s => s.category === selectedCategory);

  const priced = sessions.filter(s => s.cost !== null);
  const withEnergy = sessions.filter(s => s.kwh !== null);
  const cost = priced.reduce((sum, s) => sum + s.cost!, 0);
  const energy = withEnergy.reduce((sum, s) => sum + s.kwh!, 0);
  const rated = sessions.filter(s => s.cost !== null && s.kwh !== null && s.kwh > 0);
  const ratedEnergy = rated.reduce((sum, s) => sum + s.kwh!, 0);
  const ratedCost = rated.reduce((sum, s) => sum + s.cost!, 0);

  function download() {
    const quote = (s: string) => '"' + s.replaceAll('"', '""') + '"';
    const rows = [
      'Start (UTC),End (UTC),Category,Location,Energy (kWh),Cost (GBP),Cost basis,Type',
      ...sessions.map(s => [
        quote(s.start),
        quote(s.end),
        quote(s.category ?? 'Home'),
        quote(s.location || 'Home / Octopus'),
        s.kwh ?? '',
        s.cost ?? '',
        quote(s.costBasis),
        quote(s.type)
      ].join(','))
    ];
    const url = URL.createObjectURL(new Blob([rows.join('\n')], {type: 'text/csv'}));
    const a = document.createElement('a');
    a.href = url;
    a.download = `tesla-charging-${selectedCategory.toLowerCase().replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const isCharging = data && data.state === 'Charging';
  const liveCategory: ChargerCategory = isCharging
    ? classifyCharge({
        type: data.state,
        powerKw: data.power,
        location: data.power > 50 ? 'Supercharger' : 'Home'
      })
    : 'Home';

  return (
    <>
      {isCharging && data && (
        <section className="panel live-charging-hero" aria-label="Active charging session">
          <div className="panel-top">
            <div>
              <span className="eyebrow"><span className="tiny-dot live-dot"/>CURRENT CHARGING SESSION</span>
              <h3><BatteryCharging size={20}/>Charging now</h3>
            </div>
            <div className="live-hero-badges">
              <CategoryBadge category={liveCategory}/>
              <span className="live-label"><span className="tiny-dot"/>Live from your car</span>
            </div>
          </div>

          <div className="live-hero-main">
            <div className="live-hero-battery">
              <div className="battery-value">{data.battery}<span>%</span></div>
              <p>{data.range.toFixed(0)} miles <span>estimated range</span></p>
              <div className="progress">
                <i style={{width: `${Math.min(100, Math.max(0, data.battery))}%`}}/>
                <b style={{left: `${Math.min(100, Math.max(0, data.limit))}%`}} title={`Limit: ${data.limit}%`}/>
              </div>
              <div className="progress-label">
                <span>Battery {data.battery}%</span>
                <span>Target limit {data.limit}%</span>
              </div>
            </div>

            <div className="live-hero-stats">
              <div className="stat-card">
                <span><Zap size={14}/>Charging power</span>
                <strong>{data.power} <small>kW</small></strong>
                <small>{liveCategory === 'Supercharger' ? 'DC Rapid' : liveCategory === 'Fast public' ? 'Public fast' : 'AC rate'}</small>
              </div>
              <div className="stat-card">
                <span><Clock size={14}/>Time remaining</span>
                <strong>{data.hours > 0 ? data.hours.toFixed(1) : '—'} <small>{data.hours > 0 ? 'hrs' : ''}</small></strong>
                <small>Car's estimate to {data.limit}%</small>
              </div>
              <div className="stat-card">
                <span><PlugZap size={14}/>Energy added</span>
                <strong>{data.added.toFixed(1)} <small>kWh</small></strong>
                <small>In this session</small>
              </div>
              <div className="stat-card">
                <span><Gauge size={14}/>{data.forecast?.soFar != null ? 'Cost so far' : 'Predicted total'}</span>
                <strong>{data.forecast?.soFar != null ? money(data.forecast.soFar) : data.forecast ? money(data.forecast.total) : '—'}<small> est.</small></strong>
                <small>{data.rate != null ? `${data.rate.toFixed(1)}p / kWh` : 'Current tariff'}</small>
              </div>
            </div>
          </div>

          {data.schedule && data.schedule.slots && data.schedule.slots.length > 0 && (
            <div className="live-timeline-wrap">
              <ChargingTimeline schedule={data.schedule} updated={data.updated}/>
            </div>
          )}
        </section>
      )}

      <section className="metrics history-summary" aria-label="Historical charging summary">
        <div className="panel metric">
          <span>{selectedCategory === 'All' ? 'Evaluated charging cost' : `${selectedCategory} cost`} <PlugZap size={16}/></span>
          <strong>{priced.length ? money(cost) : '—'} <em>{priced.some(s => s.costBasis === 'estimated') ? 'est.' : ''}</em></strong>
          <small>{priced.length} priced / {sessions.length - priced.length} unpriced sessions</small>
        </div>
        <div className="panel metric">
          <span>{selectedCategory === 'All' ? 'Energy added' : `${selectedCategory} energy`} <Zap size={16}/></span>
          <strong>{withEnergy.length ? energy.toLocaleString('en-GB', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : '—'} <em>kWh</em></strong>
          <small>{period} / recorded energy</small>
        </div>
        <div className="panel metric">
          <span>Recorded sessions <Clock size={16}/></span>
          <strong>{allFilteredSessions.length ? sessions.length : (history ? 0 : '—')}</strong>
          <small>{period} / {selectedCategory === 'All' ? 'all charger types' : selectedCategory}</small>
        </div>
        <div className="panel metric">
          <span>Average unit cost <Gauge size={16}/></span>
          <strong>{ratedEnergy ? (ratedCost / ratedEnergy * 100).toFixed(1) : '—'} <em>p/kWh</em></strong>
          <small>Weighted by energy / priced sessions only</small>
        </div>
      </section>

      <section className="panel history historical-session-panel">
        <div className="panel-top">
          <div>
            <span className="eyebrow">ENERGY WELL SPENT</span>
            <h3>Recorded sessions</h3>
          </div>
          <button className="text-button" disabled={!sessions.length} onClick={download}>
            <Download size={14}/>Export CSV
          </button>
        </div>

        <div className="category-filters" role="tablist" aria-label="Filter charges by charger category">
          {(['All', 'Home', 'Supercharger', 'Fast public', 'Slow public'] as const).map(cat => (
            <button
              key={cat}
              role="tab"
              aria-selected={selectedCategory === cat}
              className={`category-filter-btn ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat === 'Home' && <Home size={12}/>}
              {cat === 'Supercharger' && <Zap size={12} fill="currentColor"/>}
              {cat === 'Fast public' && <Gauge size={12}/>}
              {cat === 'Slow public' && <BatteryCharging size={12}/>}
              <span>{cat === 'Supercharger' ? 'Superchargers' : cat}</span>
              <span className="filter-count">{counts[cat]}</span>
            </button>
          ))}
        </div>

        <div className="history-context">
          <strong>{period} / {sessions.length} {selectedCategory === 'All' ? '' : selectedCategory.toLowerCase()} sessions</strong>
          <span>{history?.message ?? (data?.demo ? 'Demo garage charging history.' : 'Loading your recorded charging sessions...')}</span>
          {history?.updated && (
            <small>Synced {stamp(history.updated)} / UK time{history.status === 'stale' ? ' / saved copy' : ''}</small>
          )}
        </div>

        {sessions.length ? (
          <div className="table-scroll history-records">
            <table>
              <thead>
                <tr>
                  <th>CHARGING PERIOD / UK TIME</th>
                  <th>CHARGER / LOCATION</th>
                  <th>TARIFF / TYPE</th>
                  <th>ENERGY ADDED</th>
                  <th>COST</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div className="cell-location">
                        <span className={`table-icon ${s.category === 'Supercharger' ? 'super' : s.category === 'Fast public' ? 'fast' : s.category === 'Slow public' ? 'slow' : ''}`}>
                          {s.category === 'Supercharger' ? <Zap size={16} fill="currentColor"/> : s.category === 'Fast public' ? <Gauge size={16}/> : s.category === 'Slow public' ? <BatteryCharging size={16}/> : <Home size={16}/>}
                        </span>
                        <div>
                          {stamp(s.start)}
                          <small>to {stamp(s.end)}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="charger-cell">
                        <CategoryBadge category={s.category ?? 'Home'}/>
                        <span className="location-name">{s.location || (s.category === 'Home' ? 'Home / Octopus' : 'Public charger')}</span>
                      </div>
                    </td>
                    <td>
                      <span className="tariff-type-tag">{s.tariff ? s.tariff : s.type.toLowerCase()}</span>
                    </td>
                    <td>
                      {s.kwh?.toFixed(1) ?? '—'} <small>kWh</small>
                    </td>
                    <td>
                      {s.cost === null ? 'Unavailable' : money(s.cost)}
                      <small className="cost-basis">
                        {s.costBasis === 'estimated' ? 'estimate' : s.costBasis === 'provider' ? 'provider cost' : 'Not enough tariff detail'}
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="consumer-empty">
            <PlugZap size={24}/>
            <h4>
              {!history && !data?.demo
                ? 'Loading charging history...'
                : history?.status === 'unavailable'
                ? 'History is temporarily unavailable.'
                : `No ${selectedCategory === 'All' ? '' : selectedCategory.toLowerCase() + ' '}sessions in this period.`}
            </h4>
            <p>
              {history || data?.demo
                ? selectedCategory !== 'All'
                  ? `There are no recorded ${selectedCategory.toLowerCase()} charges in this period. Choose another filter or period.`
                  : 'Choose a different reporting period to see available sessions.'
                : 'Retrieving your recorded sessions and historical costs.'}
            </p>
          </div>
        )}
        <div className="table-footer">
          Octopus & Tesla charging history / Home charging pricing uses historical SMART rates / Public pricing based on reported costs / Excludes vehicle standing charges
        </div>
      </section>

      <footer>
        <span>Historical records from Octopus & Tesla / UK time</span>
        {onEstimates && (
          <button onClick={onEstimates}>Data & estimates</button>
        )}
      </footer>
    </>
  );
}
