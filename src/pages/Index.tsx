
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sidebar } from "@/components/Sidebar";
import { Dashboard } from "@/components/Dashboard";
import { MembersManagement } from "@/components/MembersManagement";
import { MeetingMinutes } from "@/components/MeetingMinutes";
import { BudgetManagement } from "@/components/BudgetManagement";
import { BudgetPlanning } from "@/components/BudgetPlanning";
import { MailingList } from "@/components/MailingList";

const Index = () => {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard":
        return <Dashboard />;
      case "members":
        return <MembersManagement />;
      case "minutes":
        return <MeetingMinutes />;
      case "budget":
        return <BudgetManagement />;
      case "planning":
        return <BudgetPlanning />;
      case "mailing":
        return <MailingList />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar 
        activeSection={activeSection} 
        setActiveSection={setActiveSection}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
      />
      <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
        <div className="p-6">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default Index;
