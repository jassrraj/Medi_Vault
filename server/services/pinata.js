const pinataEndpoint = 'https://uploads.pinata.cloud/v3/files';

export const uploadEncryptedFile = async (buffer, fileName) => {
  if (!process.env.PINATA_JWT) throw new Error('PINATA_JWT is not configured');
  const form = new FormData();
  form.append('file', new Blob([buffer]), `${fileName}.encrypted`);
  form.append('network', 'public');
  form.append('name', `${fileName}.encrypted`);
  const response = await fetch(pinataEndpoint, { method: 'POST', headers: { Authorization: `Bearer ${process.env.PINATA_JWT}` }, body: form });
  if (!response.ok) throw new Error(`Pinata upload failed (${response.status}). Create a Pinata key with the org:files:write permission.`);
  const result = await response.json();
  if (!result.data?.cid) throw new Error('Pinata upload completed without returning an IPFS CID');
  return result.data.cid;
};

export const downloadEncryptedFile = async (cid) => {
  const gateway = (process.env.PINATA_GATEWAY_URL || 'https://gateway.pinata.cloud/ipfs').replace(/\/$/, '');
  const response = await fetch(`${gateway}/${encodeURIComponent(cid)}`);
  if (!response.ok) throw new Error(`IPFS download failed (${response.status})`);
  return Buffer.from(await response.arrayBuffer());
};
