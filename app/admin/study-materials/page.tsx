              </select>
            </div>

            {accessType === 'paid' && (
              <div>
                <label style={labelStyle} htmlFor="material-price">Price in INR (₹) *</label>
                <input id="material-price" type="number" min="1" step="1"
                  style={inputStyle} required value={price}
                  onChange={e => setPrice(e.target.value)} placeholder="e.g. 99" />
              </div>
            )}

            <div>
              <label style={labelStyle} htmlFor="material-status">Publishing status</label>
              <select id="material-status" style={inputStyle} value={status}
                onChange={e => setStatus(e.target.value)}>
                <option value="draft">Save as Draft</option>
                <option value="published">Publish</option>
              </select>
            </div>

            <div>
              <label style={labelStyle} htmlFor="material-pdf">
                {editingId ? 'Replace PDF (optional; maximum 20 MB)' : 'Select PDF file * (Maximum 20 MB)'}
              </label>
              <input id="material-pdf" type="file" accept=".pdf,application/pdf"
                required={!editingId} style={inputStyle}
                onChange={e => setFile(e.target.files?.[0] || null)} />
              {editingId && (
                <p style={{ color: '#647b91', fontSize: 13, marginTop: 6 }}>
                  Leave this blank to keep the current PDF. If you change Free/Paid access, you must also upload a replacement PDF.
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="submit" disabled={busy} style={{
                background: '#102d49',
                color: '#fff',
                border: 0,
                padding: '15px 20px',
                borderRadius: 8,
                fontWeight: 700,
                cursor: busy ? 'wait' : 'pointer',
              }}>
                {busy ? 'Please wait…' : editingId ? 'Save Changes' : 'Save Study Material'}
              </button>

              {editingId && (
                <button type="button" disabled={busy} onClick={clearForm} style={{
                  background: '#e9eef3',
                  color: '#17324d',
                  border: 0,
                  padding: '15px 20px',
                  borderRadius: 8,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}>
                  Cancel Edit
                </button>
              )}
            </div>
          </form>

          <section style={{ marginTop: 35, maxWidth: 1100 }}>
            <h2>Uploaded study materials</h2>
            {materials.length === 0 ? (
              <p style={{ color: '#647b91' }}>No study materials have been added yet.</p>
            ) : (
              <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #dce5ec', borderRadius: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 850 }}>
                  <thead>
                    <tr>
                      {['Title', 'Exam category', 'Subject', 'Access', 'Price', 'Status', 'Actions'].map(x => (
                        <th key={x} style={{ padding: 12, borderBottom: '1px solid #dce5ec' }}>{x}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map(item => (
                      <tr key={item.id}>
                        <td style={{ padding: 12, borderBottom: '1px solid #edf1f5' }}>{item.title}</td>
                        <td style={{ padding: 12, borderBottom: '1px solid #edf1f5' }}>{item.exam_category || '—'}</td>
                        <td style={{ padding: 12, borderBottom: '1px solid #edf1f5' }}>{item.subject || '—'}</td>
                        <td style={{ padding: 12, borderBottom: '1px solid #edf1f5' }}>{item.access_type}</td>
                        <td style={{ padding: 12, borderBottom: '1px solid #edf1f5' }}>
                          {item.access_type === 'paid' ? `₹${item.price}` : 'Free'}
                        </td>
                        <td style={{ padding: 12, borderBottom: '1px solid #edf1f5' }}>{item.status}</td>
                        <td style={{ padding: 12, borderBottom: '1px solid #edf1f5', whiteSpace: 'nowrap' }}>
                          <button type="button" disabled={busy} onClick={() => startEdit(item)}
                            style={{ ...actionStyle, background: '#e8f1fb', color: '#174a7c' }}>
                            Edit
                          </button>
                          <button type="button" disabled={busy} onClick={() => togglePublishing(item)}
                            style={{ ...actionStyle, background: item.status === 'published' ? '#fff3df' : '#e5f8ef', color: item.status === 'published' ? '#8a5700' : '#087443' }}>
                            {item.status === 'published' ? 'Unpublish' : 'Publish'}
                          </button>
                          <button type="button" disabled={busy} onClick={() => deleteMaterial(item)}
                            style={{ ...actionStyle, background: '#fff0f0', color: '#bd2525' }}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
