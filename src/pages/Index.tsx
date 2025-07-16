import { FileSidebar } from '@/components/FileSidebar';
import { CodeEditor } from '@/components/CodeEditor';
import { ActivityPanel } from '@/components/ActivityPanel';

const Index = () => {
  return (
    <div className="min-h-screen bg-background flex">
      <FileSidebar />
      <CodeEditor />
      <ActivityPanel />
    </div>
  );
};

export default Index;
