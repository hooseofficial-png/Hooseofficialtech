'use client';
import { useEffect, useState } from 'react';
import Summary from '@/components/Summary';
import { useProject } from '@/components/ProjectProvider';
import { sb } from '@/lib/supabase/client';
import { currentUser } from '@/lib/me';

export default function SummaryPage() {
  const { data, signed, openFile } = useProject();
  const [me, setMe] = useState('');
  useEffect(() => { currentUser().then(u => setMe(u?.email || '')); }, []);
  if (!data) return null;
  return <Summary data={data} logoUrl={signed(data.project.logo_path)} open={openFile} author={me} />;
}
