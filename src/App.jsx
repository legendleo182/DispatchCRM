import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import * as XLSX from 'xlsx';

const INITIAL_FORM = {
  date: new Date().toISOString().split('T')[0],
  partyName: '',
  rm: '',
  paymentMode: '',
  pendencyNumber: '',
  pendencyClosed: false,
  itemName: '',
  mtr: '',
  grnNo: '',
  grnComplete: false,
  discountEnabled: false,
  discountPercent: '',
  chargesEnabled: false,
  chargesName: '',
  dispatchVia: '',
  billNo: '',
  biltyNo: '',
  biltyWhatsapp: false,
  biltyWebsite: false,
  dispatchDone: false,
};

export default function App() {
  const [form, setForm] = useState({ ...INITIAL_FORM, date: new Date().toISOString().split('T')[0] });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [records, setRecords] = useState([]);
  const [showRecords, setShowRecords] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleting, setDeleting] = useState(null);

  // ---- SEARCH STATE ----
  const [searchText, setSearchText] = useState('');
  const [searchStatus, setSearchStatus] = useState('');

  useEffect(() => {
    fetchRecords();
  }, []);

  async function fetchRecords(searchTxt = '', searchSt = '') {
    let query = supabase
      .from('dispatch_entries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (searchTxt) {
      query = query.ilike('party_name', `%${searchTxt}%`);
    }
    if (searchSt) {
      query = query.eq('status', searchSt);
    }

    const { data } = await query;
    if (data) setRecords(data);
  }

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function clearForm() {
    setForm({ ...INITIAL_FORM, date: new Date().toISOString().split('T')[0] });
    setEditingId(null);
    setMessage(null);
  }

  // ---- LOAD RECORD INTO FORM FOR EDITING ----
  function editRecord(record) {
    setForm({
      date: record.date,
      partyName: record.party_name || '',
      rm: record.rm || '',
      paymentMode: record.payment_mode || '',
      pendencyNumber: record.pendency_number || '',
      pendencyClosed: record.pendency_closed || false,
      itemName: record.item_name || '',
      mtr: record.mtr || '',
      grnNo: record.grn_no || '',
      grnComplete: record.grn_complete || false,
      discountEnabled: record.discount_enabled || false,
      discountPercent: record.discount_percent != null ? String(record.discount_percent) : '',
      chargesEnabled: record.charges_enabled || false,
      chargesName: record.charges_name || '',
      dispatchVia: record.dispatch_via || '',
      billNo: record.bill_no || '',
      biltyNo: record.bilty_no || '',
      biltyWhatsapp: record.bilty_whatsapp || false,
      biltyWebsite: record.bilty_website || false,
      dispatchDone: record.dispatch_done || false,
    });
    setEditingId(record.id);
    setMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---- DELETE RECORD ----
  async function deleteRecord(id) {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    setDeleting(id);
    const { error } = await supabase.from('dispatch_entries').delete().eq('id', id);
    if (error) {
      setMessage({ type: 'error', text: 'Delete failed: ' + error.message });
    } else {
      setMessage({ type: 'success', text: 'Record deleted successfully!' });
      if (editingId === id) clearForm();
      fetchRecords(searchText, searchStatus);
    }
    setDeleting(null);
  }

  // ---- SAVE (INSERT or UPDATE) ----
  async function saveForm() {
    if (!form.partyName.trim()) {
      setMessage({ type: 'error', text: 'Please enter Party Name!' });
      return;
    }

    setSaving(true);
    setMessage(null);

    const payload = {
      date: form.date,
      party_name: form.partyName.trim(),
      rm: form.rm.trim(),
      payment_mode: form.paymentMode,
      pendency_number: form.pendencyNumber.trim() || null,
      pendency_closed: form.pendencyClosed,
      item_name: form.itemName.trim(),
      mtr: form.mtr.trim(),
      grn_no: form.grnNo.trim(),
      grn_complete: form.grnComplete,
      discount_enabled: form.discountEnabled,
      discount_percent: form.discountEnabled ? Number(form.discountPercent) || 0 : null,
      charges_enabled: form.chargesEnabled,
      charges_name: form.chargesEnabled ? form.chargesName.trim() : null,
      dispatch_via: form.dispatchVia.trim(),
      bill_no: form.billNo.trim(),
      bilty_no: form.biltyNo.trim(),
      bilty_whatsapp: form.biltyWhatsapp,
      bilty_website: form.biltyWebsite,
      dispatch_done: form.dispatchDone,
      status: form.dispatchDone ? 'CLOSED' : 'PENDING',
    };

    let error;
    if (editingId) {
      // UPDATE existing record
      const res = await supabase.from('dispatch_entries').update(payload).eq('id', editingId);
      error = res.error;
    } else {
      // INSERT new record
      const res = await supabase.from('dispatch_entries').insert([payload]);
      error = res.error;
    }

    if (error) {
      setMessage({ type: 'error', text: 'Save failed: ' + error.message });
    } else {
      setMessage({ type: 'success', text: editingId ? 'Record updated successfully!' : 'Dispatch saved successfully!' });
      clearForm();
      fetchRecords(searchText, searchStatus);
    }

    setSaving(false);
  }

  // ---- SEARCH HANDLERS ----
  function handleSearch() {
    fetchRecords(searchText, searchStatus);
  }

  function handleClearSearch() {
    setSearchText('');
    setSearchStatus('');
    fetchRecords('', '');
  }

  // ---- EXPORT TO EXCEL (ROW-WISE / HORIZONTAL FORMAT) ----
  function exportToExcel() {
    if (records.length === 0) {
      setMessage({ type: 'error', text: 'No records to export!' });
      return;
    }

    const yn = (val) => (val ? 'YES' : 'NO');

    const rows = records.map((r) => ({
      'Date': r.date || '',
      'Party Name': r.party_name || '',
      'RM': r.rm || '',
      'Payment Mode': r.payment_mode || '',
      'Pendency No': r.pendency_number != null ? r.pendency_number : '',
      'Pendency Closed': yn(r.pendency_closed),
      'Item Name': r.item_name || '',
      'MTR': r.mtr || '',
      'GRN No': r.grn_no || '',
      'GRN Complete': yn(r.grn_complete),
      'Discount': yn(r.discount_enabled),
      'Discount %': r.discount_enabled ? (r.discount_percent != null ? r.discount_percent + '%' : '0%') : '',
      'Charges': yn(r.charges_enabled),
      'Charge Name': r.charges_enabled ? (r.charges_name || '') : '',
      'Dispatch Via': r.dispatch_via || '',
      'Bill No': r.bill_no || '',
      'Bilty No': r.bilty_no || '',
      'Bilty WhatsApp': yn(r.bilty_whatsapp),
      'Bilty Website': yn(r.bilty_website),
      'Dispatch Done': yn(r.dispatch_done),
      'Status': r.status || 'PENDING',
    }));

    const headers = [
      'Date', 'Party Name', 'RM', 'Payment Mode',
      'Pendency No', 'Pendency Closed',
      'Item Name', 'MTR', 'GRN No', 'GRN Complete',
      'Discount', 'Discount %', 'Charges', 'Charge Name',
      'Dispatch Via', 'Bill No', 'Bilty No',
      'Bilty WhatsApp', 'Bilty Website',
      'Dispatch Done', 'Status',
    ];

    const ws = XLSX.utils.json_to_sheet(rows, { header: headers });

    // Set column widths
    ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 14) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dispatch Data');

    const fileName = `Dispatch_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);

    setMessage({ type: 'success', text: `Exported ${records.length} records to ${fileName}` });
  }

  const statusBadge = (status) => (
    <span className={`badge ${status === 'CLOSED' ? 'badge-closed' : 'badge-pending'}`}>
      {status}
    </span>
  );

  const tick = (val) => val ? '✅' : '⬜';

  // ---- COUNT FILTERED RESULTS ----
  const isEditing = editingId !== null;

  return (
    <div className="app-container">
      <h1 className="app-title">📦 Dispatch CRM System</h1>
      <p className="app-subtitle">Manage your dispatch entries with Supabase</p>

      {/* ============ FORM ============ */}
      <div className={`card form-card ${isEditing ? 'form-card-editing' : ''}`}>
        <h2 className="card-title">
          {isEditing ? '✏️ Edit Dispatch Entry' : '📝 New Dispatch Entry'}
          {isEditing && <span className="edit-badge">Editing ID: {editingId}</span>}
        </h2>

        {/* ---- 1. DATE ---- */}
        <fieldset className="fieldset">
          <legend>📅 Date</legend>
          <div className="row">
            <label className="label">Dispatch Date:</label>
            <input
              type="date"
              value={form.date}
              onChange={e => update('date', e.target.value)}
              className="input"
            />
          </div>
        </fieldset>

        {/* ---- 2. PARTY INFORMATION ---- */}
        <fieldset className="fieldset">
          <legend>🏢 Party Information</legend>
          <div className="grid-3">
            <div>
              <label className="label">Party Name <span className="required">*</span></label>
              <input
                type="text"
                placeholder="Enter party name"
                value={form.partyName}
                onChange={e => update('partyName', e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">RM (Relationship Manager)</label>
              <input
                type="text"
                placeholder="Enter RM name"
                value={form.rm}
                onChange={e => update('rm', e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">Payment Mode</label>
              <select
                value={form.paymentMode}
                onChange={e => update('paymentMode', e.target.value)}
                className="input"
              >
                <option value="">-- Select --</option>
                <option value="Cash">💵 Cash</option>
                <option value="Credit">💳 Credit</option>
              </select>
            </div>
          </div>
        </fieldset>

        {/* ---- 3. PENDENCY ---- */}
        <fieldset className="fieldset">
          <legend>🔔 Pendency</legend>
          <div className="row">
            <div className="flex-1">
              <label className="label">Pendency Number</label>
              <input
                type="text"
                placeholder="Enter pendency number (optional)"
                value={form.pendencyNumber}
                onChange={e => update('pendencyNumber', e.target.value)}
                className="input"
              />
              <small className="hint">Leave blank if no pendency</small>
            </div>
            <div className="tick-box">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.pendencyClosed}
                  onChange={e => update('pendencyClosed', e.target.checked)}
                />
                <span className="check-text">{form.pendencyClosed ? '✅ Pendency Closed' : '⬜ Pendency Open'}</span>
              </label>
            </div>
          </div>
        </fieldset>

        {/* ---- 4. ITEM DETAILS ---- */}
        <fieldset className="fieldset">
          <legend>📋 Item Details</legend>
          <div className="grid-3">
            <div>
              <label className="label">Item Name</label>
              <input
                type="text"
                placeholder="Enter item name"
                value={form.itemName}
                onChange={e => update('itemName', e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">MTR</label>
              <input
                type="text"
                placeholder="Enter MTR"
                value={form.mtr}
                onChange={e => update('mtr', e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">GRN No</label>
              <input
                type="text"
                placeholder="Enter GRN number"
                value={form.grnNo}
                onChange={e => update('grnNo', e.target.value)}
                className="input"
              />
              <label className="checkbox-label" style={{ marginTop: 4 }}>
                <input
                  type="checkbox"
                  checked={form.grnComplete}
                  onChange={e => update('grnComplete', e.target.checked)}
                />
                <span className="check-text">{form.grnComplete ? '✅ GRN Complete' : '⬜ GRN Pending'}</span>
              </label>
            </div>
          </div>
        </fieldset>

        {/* ---- 5. PRICING & CHARGES ---- */}
        <fieldset className="fieldset">
          <legend>💰 Pricing & Charges</legend>
          <div className="grid-2">
            {/* Discount */}
            <div className="sub-box">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.discountEnabled}
                  onChange={e => update('discountEnabled', e.target.checked)}
                />
                <span className="check-text"><strong>Discount Applicable?</strong></span>
              </label>
              {form.discountEnabled && (
                <div className="mt-8">
                  <label className="label">Discount %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="e.g. 10"
                    value={form.discountPercent}
                    onChange={e => update('discountPercent', e.target.value)}
                    className="input"
                  />
                </div>
              )}
            </div>

            {/* Charges */}
            <div className="sub-box">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.chargesEnabled}
                  onChange={e => update('chargesEnabled', e.target.checked)}
                />
                <span className="check-text"><strong>Extra Charges?</strong></span>
              </label>
              {form.chargesEnabled && (
                <div className="mt-8">
                  <label className="label">Charge Name (e.g. Freight, Loading)</label>
                  <input
                    type="text"
                    placeholder="Enter charge name"
                    value={form.chargesName}
                    onChange={e => update('chargesName', e.target.value)}
                    className="input"
                  />
                </div>
              )}
            </div>
          </div>
        </fieldset>

        {/* ---- 6. DISPATCH DETAILS ---- */}
        <fieldset className="fieldset">
          <legend>🚚 Dispatch Details</legend>
          <div className="grid-3">
            <div>
              <label className="label">Dispatch Via (Transporter Name)</label>
              <input
                type="text"
                placeholder="e.g. VRL Logistics"
                value={form.dispatchVia}
                onChange={e => update('dispatchVia', e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">Bill No</label>
              <input
                type="text"
                placeholder="e.g. B-2024/001"
                value={form.billNo}
                onChange={e => update('billNo', e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">Bilty No (LR No)</label>
              <input
                type="text"
                placeholder="Enter bilty / LR number"
                value={form.biltyNo}
                onChange={e => update('biltyNo', e.target.value)}
                className="input"
              />
            </div>
          </div>
        </fieldset>

        {/* ---- 7. BILTY SHARING TICKS ---- */}
        <fieldset className="fieldset">
          <legend>📱 Bilty Sharing Status</legend>
          <div className="row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.biltyWhatsapp}
                onChange={e => update('biltyWhatsapp', e.target.checked)}
              />
              <span className="check-text">{form.biltyWhatsapp ? '✅ Bilty Sent on WhatsApp' : '⬜ Bilty WhatsApp'}</span>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.biltyWebsite}
                onChange={e => update('biltyWebsite', e.target.checked)}
              />
              <span className="check-text">{form.biltyWebsite ? '✅ Bilty Uploaded on Website' : '⬜ Bilty Website'}</span>
            </label>
          </div>
        </fieldset>

        {/* ---- 8. DISPATCH DONE ---- */}
        <fieldset className="fieldset dispatch-done-fieldset">
          <legend>🏁 Final Status</legend>
          <label className="checkbox-label dispatch-done-label">
            <input
              type="checkbox"
              checked={form.dispatchDone}
              onChange={e => update('dispatchDone', e.target.checked)}
            />
            <span className="check-text">
              {form.dispatchDone ? '✅ Dispatch Done (Status: CLOSED)' : '⬜ Dispatch Pending (Status: PENDING)'}
            </span>
          </label>
        </fieldset>

        {/* ---- 9. ACTION BUTTONS ---- */}
        <div className="action-buttons">
          <button onClick={saveForm} disabled={saving} className="btn btn-save">
            {saving ? '⏳ Saving...' : isEditing ? '✏️ Update Record' : '💾 Save Form'}
          </button>
          {isEditing && (
            <button onClick={clearForm} disabled={saving} className="btn btn-cancel">
              ❌ Cancel Edit
            </button>
          )}
          <button onClick={clearForm} disabled={saving} className="btn btn-clear">
            🗑️ Clear Form
          </button>
          <button
            onClick={() => {
              setShowRecords(!showRecords);
              if (!showRecords) fetchRecords(searchText, searchStatus);
            }}
            className="btn btn-view"
          >
            {showRecords ? '🙈 Hide Records' : '📋 View All Records'}
          </button>
        </div>

        {/* Message */}
        {message && (
          <div className={`msg ${message.type === 'error' ? 'msg-error' : 'msg-success'}`}>
            {message.text}
          </div>
        )}
      </div>

      {/* ============ SEARCH + RECORDS TABLE ============ */}
      {showRecords && (
        <div className="card table-card">
          <h2 className="card-title">📋 Dispatch Records ({records.length})</h2>

          {/* ---- SEARCH BAR ---- */}
          <div className="search-bar">
            <div className="search-row">
              <input
                type="text"
                placeholder="🔍 Search by Party Name..."
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="input search-input"
              />
              <select
                value={searchStatus}
                onChange={e => setSearchStatus(e.target.value)}
                className="input search-select"
              >
                <option value="">All Status</option>
                <option value="PENDING">🟡 PENDING</option>
                <option value="CLOSED">🟢 CLOSED</option>
              </select>
              <button onClick={handleSearch} className="btn btn-search">🔍 Search</button>
              <button onClick={handleClearSearch} className="btn btn-search-clear">✖ Reset</button>
              <button onClick={exportToExcel} className="btn btn-export" title="Export all filtered records to Excel (line-wise format)">
                📥 Export Excel
              </button>
            </div>
          </div>

          {records.length === 0 ? (
            <p className="no-data">No dispatch records found. Try adjusting your search or create a new entry above!</p>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Party</th>
                    <th>RM</th>
                    <th>Payment</th>
                    <th>Item</th>
                    <th>GRN</th>
                    <th>Dispatch Via</th>
                    <th>Bill No</th>
                    <th>Bilty No</th>
                    <th>WA</th>
                    <th>Web</th>
                    <th>Status</th>
                    <th>Pendency</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => (
                    <tr key={r.id} className={editingId === r.id ? 'row-editing' : ''}>
                      <td>{r.date}</td>
                      <td><strong>{r.party_name}</strong></td>
                      <td>{r.rm}</td>
                      <td>{r.payment_mode}</td>
                      <td>{r.item_name}</td>
                      <td>{r.grn_no} {tick(r.grn_complete)}</td>
                      <td>{r.dispatch_via}</td>
                      <td>{r.bill_no}</td>
                      <td>{r.bilty_no}</td>
                      <td>{tick(r.bilty_whatsapp)}</td>
                      <td>{tick(r.bilty_website)}</td>
                      <td>{statusBadge(r.status)}</td>
                      <td>{r.pendency_number || '—'} {r.pendency_number ? tick(r.pendency_closed) : ''}</td>
                      <td className="actions-cell">
                        <button
                          onClick={() => editRecord(r)}
                          className="btn-sm btn-edit"
                          title="Edit this record"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => deleteRecord(r.id)}
                          disabled={deleting === r.id}
                          className="btn-sm btn-delete"
                          title="Delete this record"
                        >
                          {deleting === r.id ? '⏳' : '🗑️'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}