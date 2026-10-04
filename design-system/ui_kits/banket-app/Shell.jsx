const { Sidebar, AppHeader, UserMenu, Tabs } = window.BanketDesignSystem_f9651f;

function AppShell({ page, onNavigate, title, breadcrumb, tabs, activeTab, onTab, children, contentStyle }) {
  const u = window.BK_DATA.user;
  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg-app)" }}>
      <Sidebar activeKey={page} onSelect={onNavigate} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", position: "relative" }}>
        <AppHeader title={title} breadcrumb={breadcrumb}
          user={<UserMenu name={u.name} role={u.role} items={[{ label: "Meu perfil", icon: "user" }, { label: "Configurações", icon: "settings", onClick: () => onNavigate("configuracoes") }, { divider: true }, { label: "Sair", icon: "logout", danger: true }]} />} />
        {tabs ? <Tabs items={tabs} activeKey={activeTab} onChange={onTab} /> : null}
        <main style={{ flex: 1, overflowY: "auto", padding: "var(--content-pad-y) var(--content-pad-x) 48px", ...contentStyle }}>
          {children}
        </main>
      </div>
    </div>
  );
}

function PageIntro({ children, style }) {
  return <p className="bk-intro" style={{ marginBottom: 20, ...style }}>{children}</p>;
}

Object.assign(window, { AppShell, PageIntro });
