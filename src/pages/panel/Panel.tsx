import React from 'react';
import '@pages/panel/Panel.css';
import { db, notesTable } from '../background/db';

export default function Panel() {
  const [additionalInfo, setAdditionalInfo] = React.useState('');
  const [sidePanelData, setSidePanelData] = React.useState<any>(null);
  const save = React.useCallback( async () => {
    // Save note to database
    await db.insert(notesTable).values({
      ...sidePanelData.data,
      additionalInfo,
    });
    alert('Note saved!');
  }, [sidePanelData, additionalInfo]);
  React.useEffect(() => {
    // Fetch side panel data from storage
    chrome.storage.local.get('sidePanelData', (result) => {
      setSidePanelData(result.sidePanelData);
    });
  }, []);
  return (
    <div className="m-10">
      {sidePanelData && <div className="card bg-base-100 shadow-sm">
  <figure>
    <img
      src={sidePanelData.data.favIconUrl}
      alt={sidePanelData.data.url} />
  </figure>
  <div className="card-body">
    {/* <h2 className="card-title">
      {sidePanelData.data.url}
      <div className="badge badge-secondary">NEW</div>
    </h2> */}
    <p>{sidePanelData.data.content}</p>
    <textarea className="textarea" placeholder="Additional Info" value={additionalInfo} onChange={e => setAdditionalInfo(e.target.value)}></textarea>
    <div className="card-actions justify-end">
      <button className="btn btn-soft btn-primary" onClick={save}>Save</button>
      <button className="btn btn-soft">Cancel</button>
    </div>
  </div>
</div>}
    </div>
  );
}
