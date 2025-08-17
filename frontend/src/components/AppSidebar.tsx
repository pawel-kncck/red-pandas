import {
  Database,
  FileSpreadsheet,
  Plus,
  Circle,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Session } from '@/types';

interface AppSidebarProps {
  sessions: Session[];
  currentSession: Session | null;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
}

export function AppSidebar({
  sessions,
  currentSession,
  onSelectSession,
  onNewSession,
  healthStatus,
}: AppSidebarProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const statusColor = 
    healthStatus === 'healthy' ? 'text-green-500' : 
    healthStatus === 'degraded' ? 'text-yellow-500' : 'text-red-500';

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-3">
          <Database className="h-5 w-5 text-sidebar-foreground" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-sidebar-foreground">
              Red Pandas
            </h2>
            <p className="text-xs text-muted-foreground">
              Data Analytics
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between">
            <span>Sessions</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={onNewSession}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <ScrollArea className="h-[400px]">
              <SidebarMenu>
                {sessions.length === 0 ? (
                  <div className="px-3 py-6 text-center">
                    <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      No sessions yet
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Upload a CSV to start
                    </p>
                  </div>
                ) : (
                  sessions.map((session) => (
                    <SidebarMenuItem key={session.id}>
                      <SidebarMenuButton
                        isActive={currentSession?.id === session.id}
                        onClick={() => onSelectSession(session.id)}
                        className="w-full"
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        <div className="flex-1 text-left">
                          <p className="text-sm truncate">
                            {session.filename}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(session.created_at)}
                          </p>
                        </div>
                      </SidebarMenuButton>
                      {currentSession?.id === session.id && (
                        <SidebarMenuSub>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild>
                              <div className="text-xs text-muted-foreground">
                                {session.row_count} rows × {session.column_count} columns
                              </div>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  ))
                )}
              </SidebarMenu>
            </ScrollArea>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-2 px-3 py-2">
          <Circle className={`h-2 w-2 fill-current ${statusColor}`} />
          <span className="text-xs text-muted-foreground">
            {healthStatus === 'healthy' ? 'Connected' : 
             healthStatus === 'degraded' ? 'Degraded' : 'Disconnected'}
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}