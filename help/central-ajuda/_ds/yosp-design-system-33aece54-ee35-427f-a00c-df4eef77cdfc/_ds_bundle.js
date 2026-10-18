/* @ds-bundle: {"format":4,"namespace":"YospDesignSystem_33aece","components":[{"name":"Button","sourcePath":"components/actions/Button.jsx"},{"name":"IconButton","sourcePath":"components/actions/IconButton.jsx"},{"name":"Icon","sourcePath":"components/brand/Icon.jsx"},{"name":"Logo","sourcePath":"components/brand/Logo.jsx"},{"name":"Avatar","sourcePath":"components/data-display/Avatar.jsx"},{"name":"Badge","sourcePath":"components/data-display/Badge.jsx"},{"name":"Card","sourcePath":"components/data-display/Card.jsx"},{"name":"IconTile","sourcePath":"components/data-display/IconTile.jsx"},{"name":"Legend","sourcePath":"components/data-display/Legend.jsx"},{"name":"ListItem","sourcePath":"components/data-display/ListItem.jsx"},{"name":"Pill","sourcePath":"components/data-display/Pill.jsx"},{"name":"ProgressBar","sourcePath":"components/data-display/ProgressBar.jsx"},{"name":"StatCard","sourcePath":"components/data-display/StatCard.jsx"},{"name":"Table","sourcePath":"components/data-display/Table.jsx"},{"name":"UserChip","sourcePath":"components/data-display/UserChip.jsx"},{"name":"Banner","sourcePath":"components/feedback/Banner.jsx"},{"name":"EmptyState","sourcePath":"components/feedback/EmptyState.jsx"},{"name":"FeedItem","sourcePath":"components/feedback/FeedItem.jsx"},{"name":"Stepper","sourcePath":"components/feedback/Stepper.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"SettingRow","sourcePath":"components/forms/SettingRow.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"NavItem","sourcePath":"components/navigation/NavItem.jsx"},{"name":"PageHeader","sourcePath":"components/navigation/PageHeader.jsx"},{"name":"Pagination","sourcePath":"components/navigation/Pagination.jsx"},{"name":"SegmentedControl","sourcePath":"components/navigation/SegmentedControl.jsx"},{"name":"Sidebar","sourcePath":"components/navigation/Sidebar.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"},{"name":"Topbar","sourcePath":"components/navigation/Topbar.jsx"}],"sourceHashes":{"components/actions/Button.jsx":"8d7e9f2020ba","components/actions/IconButton.jsx":"65da539a41da","components/brand/Icon.jsx":"95aff23fef6a","components/brand/Logo.jsx":"85a7a357c61f","components/data-display/Avatar.jsx":"b8ed4c537b5a","components/data-display/Badge.jsx":"7c09683b3bec","components/data-display/Card.jsx":"e6ceb0ee072e","components/data-display/IconTile.jsx":"f1a510b7e7e7","components/data-display/Legend.jsx":"b578281c3a81","components/data-display/ListItem.jsx":"626796d6004d","components/data-display/Pill.jsx":"ed87a7276f06","components/data-display/ProgressBar.jsx":"ca65e3645518","components/data-display/StatCard.jsx":"878cd581dd77","components/data-display/Table.jsx":"b7aad6cefd20","components/data-display/UserChip.jsx":"298226c20a5e","components/feedback/Banner.jsx":"a694b5d574ed","components/feedback/EmptyState.jsx":"0dd33b0a2321","components/feedback/FeedItem.jsx":"de3b7925728f","components/feedback/Stepper.jsx":"d3ee90ad822f","components/forms/Input.jsx":"ade46a1a94fa","components/forms/Select.jsx":"2c8a236d49ea","components/forms/SettingRow.jsx":"55da34c0e7cc","components/forms/Switch.jsx":"f829d6daaf23","components/navigation/NavItem.jsx":"e1faca131826","components/navigation/PageHeader.jsx":"a5943e4bc2fb","components/navigation/Pagination.jsx":"738b08476aa7","components/navigation/SegmentedControl.jsx":"7a66e9a801b6","components/navigation/Sidebar.jsx":"5f9eab7b5c92","components/navigation/Tabs.jsx":"6c32a25b17fe","components/navigation/Topbar.jsx":"70237026a094","scratch/ds-dev.js":"202c956726f5","ui_kits/yosp-web/Agenda.jsx":"9e49b80e0ada","ui_kits/yosp-web/App.jsx":"7b2195c2e1c4","ui_kits/yosp-web/Conta.jsx":"b3e88b23d552","ui_kits/yosp-web/Dashboard.jsx":"da3ab2c182b7","ui_kits/yosp-web/Imoveis.jsx":"0969abf90c22","ui_kits/yosp-web/Perfil.jsx":"2e1eddf2efce","ui_kits/yosp-web/Prestadores.jsx":"6c0a7753eb3c","ui_kits/yosp-web/Shell.jsx":"d38050631fc0","ui_kits/yosp-web/data.js":"23408f3db7c7"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.YospDesignSystem_33aece = window.YospDesignSystem_33aece || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/brand/Icon.jsx
try { (() => {
const CDN = 'https://unpkg.com/lucide-static@0.469.0/icons/';
const store = {};
function load(name) {
  if (!store[name]) store[name] = fetch(CDN + name + '.svg').then(r => r.ok ? r.text() : '').catch(() => '');
  return store[name];
}
const txt = {};
function Icon({
  name,
  size = 20,
  strokeWidth = 1.5,
  color = 'currentColor',
  title,
  style
}) {
  const [raw, setRaw] = React.useState(txt[name] || '');
  React.useEffect(() => {
    let on = true;
    load(name).then(t => {
      txt[name] = t;
      if (on) setRaw(t);
    });
    return () => {
      on = false;
    };
  }, [name]);
  const html = raw.replace(/<!--[\s\S]*?-->/g, '').replace('width="24"', 'width="' + size + '"').replace('height="24"', 'height="' + size + '"').replace('stroke-width="2"', 'stroke-width="' + strokeWidth + '"').replace('<svg', '<svg style="display:block"');
  return /*#__PURE__*/React.createElement("span", {
    role: title ? 'img' : undefined,
    "aria-label": title,
    "aria-hidden": title ? undefined : true,
    style: {
      display: 'inline-flex',
      width: size,
      height: size,
      flex: 'none',
      color,
      lineHeight: 0,
      ...style
    },
    dangerouslySetInnerHTML: {
      __html: html
    }
  });
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Icon.jsx", error: String((e && e.message) || e) }); }

// components/actions/Button.jsx
try { (() => {
const SIZES = {
  sm: {
    h: 32,
    px: 12,
    fs: 14,
    ic: 16
  },
  md: {
    h: 40,
    px: 16,
    fs: 14,
    ic: 18
  },
  lg: {
    h: 48,
    px: 20,
    fs: 16,
    ic: 20
  }
};
const V = {
  primary: {
    bg: 'var(--surface-brand)',
    hover: 'var(--surface-brand-hover)',
    press: 'var(--surface-brand-press)',
    fg: 'var(--fg-on-brand)',
    bd: 'transparent'
  },
  secondary: {
    bg: 'var(--surface-card)',
    hover: 'var(--surface-hover)',
    press: 'var(--gray-100)',
    fg: 'var(--fg-1)',
    bd: 'var(--border-1)'
  },
  soft: {
    bg: 'var(--blue-100)',
    hover: 'var(--blue-200)',
    press: 'var(--blue-200)',
    fg: 'var(--fg-1)',
    bd: 'transparent'
  },
  outline: {
    bg: 'var(--surface-card)',
    hover: 'var(--blue-50)',
    press: 'var(--blue-100)',
    fg: 'var(--fg-brand)',
    bd: 'var(--border-brand)'
  },
  ghost: {
    bg: 'transparent',
    hover: 'var(--surface-hover)',
    press: 'var(--gray-100)',
    fg: 'var(--fg-2)',
    bd: 'transparent'
  }
};
function Button({
  variant = 'primary',
  size = 'md',
  iconLeft,
  iconRight,
  fullWidth = false,
  disabled = false,
  type = 'button',
  onClick,
  children,
  style
}) {
  const [h, setH] = React.useState(false);
  const [p, setP] = React.useState(false);
  const s = SIZES[size] || SIZES.md;
  const v = V[variant] || V.primary;
  const bg = disabled ? v.bg : p ? v.press : h ? v.hover : v.bg;
  return /*#__PURE__*/React.createElement("button", {
    type: type,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => {
      setH(false);
      setP(false);
    },
    onMouseDown: () => setP(true),
    onMouseUp: () => setP(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: s.h,
      padding: '0 ' + s.px + 'px',
      width: fullWidth ? '100%' : undefined,
      fontFamily: 'var(--font-sans)',
      fontSize: s.fs,
      fontWeight: 400,
      lineHeight: 1,
      whiteSpace: 'nowrap',
      color: v.fg,
      background: bg,
      border: '1px solid ' + v.bd,
      borderRadius: 'var(--radius-md)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? .5 : 1,
      transition: 'background var(--dur-fast) var(--ease-out)',
      ...style
    }
  }, iconLeft && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconLeft,
    size: s.ic
  }), children, iconRight && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconRight,
    size: s.ic
  }));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/actions/Button.jsx", error: String((e && e.message) || e) }); }

// components/actions/IconButton.jsx
try { (() => {
const SZ = {
  sm: {
    d: 32,
    ic: 16
  },
  md: {
    d: 40,
    ic: 18
  },
  lg: {
    d: 44,
    ic: 20
  }
};
const V = {
  outline: {
    bg: 'var(--surface-card)',
    hover: 'var(--surface-hover)',
    fg: 'var(--fg-1)',
    bd: 'var(--border-1)'
  },
  ghost: {
    bg: 'transparent',
    hover: 'var(--surface-hover)',
    fg: 'var(--fg-1)',
    bd: 'transparent'
  },
  soft: {
    bg: 'var(--blue-100)',
    hover: 'var(--blue-200)',
    fg: 'var(--blue-500)',
    bd: 'transparent'
  },
  primary: {
    bg: 'var(--surface-brand)',
    hover: 'var(--surface-brand-hover)',
    fg: 'var(--fg-on-brand)',
    bd: 'transparent'
  }
};
function IconButton({
  icon,
  label,
  variant = 'outline',
  size = 'lg',
  shape = 'circle',
  dot = false,
  disabled = false,
  onClick,
  style
}) {
  const [h, setH] = React.useState(false);
  const s = SZ[size] || SZ.lg;
  const v = V[variant] || V.outline;
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": label,
    title: label,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: s.d,
      height: s.d,
      padding: 0,
      flex: 'none',
      borderRadius: shape === 'circle' ? '50%' : 'var(--radius-md)',
      border: '1px solid ' + v.bd,
      background: h && !disabled ? v.hover : v.bg,
      color: v.fg,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? .5 : 1,
      transition: 'background var(--dur-fast) var(--ease-out)',
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: s.ic
  }), dot && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: s.d * 0.24,
      right: s.d * 0.26,
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: 'var(--yellow-500)',
      boxShadow: '0 0 0 1.5px var(--surface-card)'
    }
  }));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/actions/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/brand/Logo.jsx
try { (() => {
const WORD = ["M316.03,64.61l-31.01,50.32v26.8c0,4.87-1.84,6.97-6.97,6.97h-8.15c-5.13,0-6.97-2.1-6.97-6.97v-26.8l-30.98-50.32c-2.62-4.33-1.7-7.87,3.42-7.87h10.78c5.13,0,6.69,1.7,9.19,6.05l19.05,32.05,18.91-32.05c2.5-4.33,4.07-6.05,9.19-6.05h9.98c5.13,0,6.17,3.68,3.55,7.87Z", "M312.23,115.19c0-21.15,16.02-36.12,37.3-36.12s37.3,14.98,37.3,36.12-16.02,36.12-37.3,36.12-37.3-15.24-37.3-36.12ZM365.55,115.19c0-9.98-6.17-17.21-16.02-17.21s-16.02,7.23-16.02,17.21,6.17,17.21,16.02,17.21,16.02-7.23,16.02-17.21Z", "M400.49,146.72c-3.15-1.7-3.55-3.81-3.55-5.91v-6.43c0-2.76,1.18-4.87,4.21-4.87,4.33,0,9.46,4.6,24.7,4.6,4.47,0,7.75-1.58,7.75-5.13s-2.62-4.33-10.38-5.79l-4.21-.78c-12.62-2.36-22.2-6.83-22.2-20.09,0-17.61,14.18-22.86,29.29-22.86,11.04,0,19.31,2.36,22.59,3.94,3.02,1.44,3.55,3.28,3.55,5.91v6.43c0,3.42-1.58,4.6-4.21,4.6-4.33,0-11.82-4.07-22.2-4.07-5.39,0-7.75,1.84-7.75,4.47,0,3.15,2.5,3.94,9.85,5.25l3.68.66c12.62,2.23,23.25,6.17,23.25,21.81,0,16.68-14.18,22.46-30.87,22.46-9.98,0-20.09-2.36-23.52-4.21l-.02-.02Z", "M543.01,115.19c0,20.49-15.1,36.12-35.07,36.12-5.79,0-13.4-1.84-18.91-5.91v31.39c0,3.15-1.44,4.73-3.94,4.73-7.75,0-17.07-9.59-17.07-26.28v-70.15c0-3.15,1.58-4.73,4.07-4.73,3.55,0,8.53,3.02,12.22,8.53,4.47-5.25,13.4-9.85,23.91-9.85,20.75,0,34.81,15.36,34.81,36.12l-.02.03ZM521.72,115.19c0-10.38-7.23-17.21-16.42-17.21s-16.29,6.83-16.29,17.21,7.49,17.21,16.29,17.21,16.42-6.57,16.42-17.21Z"];
const MARK = "M102.33,18.47c-46.01,0-83.31,37.3-83.31,83.31s37.3,83.31,83.31,83.31,83.31-37.3,83.31-83.31S148.34,18.47,102.33,18.47ZM59.05,94.69c-2.84-3.53-4.55-8-4.55-12.88v-14.36c0-3.42,2.78-6.21,6.21-6.21h14.36c6.12,0,11.6,2.69,15.37,6.94,2.84,3.53,4.55,8,4.55,12.88,0,11.35-9.22,20.57-20.57,20.57-6.12,0-11.6-2.69-15.37-6.94ZM149.73,68.98l-28.18,71.75c-2.01,5.11-5.92,9.08-10.74,11.24-2.42.79-5.04,1.19-7.76,1.19h-18c-4.38,0-7.38-3.03-5.78-7.1l28.17-71.75c3.09-7.87,10.68-13.05,19.15-13.05h18.01c1.73,0,3.24.69,4.34,1.78,1.2,1.63,1.61,3.83.78,5.95Z";
const COLORS = {
  blue: 'var(--blue-500)',
  white: '#FFFFFF',
  black: 'var(--gray-900)'
};
function Logo({
  variant = 'blue',
  kind = 'wordmark',
  height = 32,
  title = 'Yosp',
  style
}) {
  const fill = COLORS[variant] || variant;
  const isMark = kind === 'mark';
  const vb = isMark ? '19.02 18.47 166.62 166.62' : '0 0 561.88 205.82';
  return /*#__PURE__*/React.createElement("svg", {
    role: "img",
    "aria-label": title,
    viewBox: vb,
    height: height,
    style: {
      display: 'block',
      flex: 'none',
      ...style
    },
    fill: fill
  }, /*#__PURE__*/React.createElement("path", {
    d: MARK
  }), !isMark && WORD.map((d, i) => /*#__PURE__*/React.createElement("path", {
    key: i,
    d: d
  })));
}
Object.assign(__ds_scope, { Logo });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Logo.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Avatar.jsx
try { (() => {
const T = {
  brand: ['var(--blue-100)', 'var(--blue-700)'],
  solid: ['var(--blue-500)', 'var(--white)'],
  yellow: ['var(--yellow-100)', 'var(--yellow-800)'],
  neutral: ['var(--gray-100)', 'var(--gray-500)']
};
function Avatar({
  src,
  name = '',
  size = 44,
  tone = 'brand',
  style
}) {
  const initials = name.replace(/[^\p{L}\s]/gu, '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const t = T[tone] || T.brand;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: size,
      height: size,
      flex: 'none',
      borderRadius: '50%',
      overflow: 'hidden',
      background: t[0],
      color: t[1],
      fontFamily: 'var(--font-sans)',
      fontSize: Math.round(size * 0.36),
      fontWeight: 500,
      letterSpacing: '0.01em',
      ...style
    }
  }, src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    }
  }) : initials);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Badge.jsx
try { (() => {
const TONES = {
  brand: ['var(--tone-brand-bg)', 'var(--tone-brand-fg)'],
  success: ['var(--tone-success-bg)', 'var(--tone-success-fg)'],
  warning: ['var(--tone-warning-bg)', 'var(--tone-warning-fg)'],
  danger: ['var(--tone-danger-bg)', 'var(--tone-danger-fg)'],
  orange: ['var(--tone-orange-bg)', 'var(--tone-orange-fg)'],
  neutral: ['var(--tone-neutral-bg)', 'var(--tone-neutral-fg)']
};
function Badge({
  tone = 'brand',
  trend,
  dot = false,
  icon,
  size = 'md',
  children,
  style
}) {
  let t = TONES[tone] || TONES.brand;
  let ic = icon;
  if (trend === 'up') {
    t = TONES.brand;
    ic = ic || 'arrow-up';
  }
  if (trend === 'down') {
    t = TONES.danger;
    ic = ic || 'arrow-down';
  }
  const sm = size === 'sm';
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      height: sm ? 20 : 24,
      padding: sm ? '0 6px' : '0 8px',
      borderRadius: 'var(--radius-sm)',
      background: t[0],
      color: t[1],
      fontFamily: 'var(--font-sans)',
      fontSize: sm ? 11 : 12,
      fontWeight: 500,
      lineHeight: 1,
      whiteSpace: 'nowrap',
      flex: 'none',
      ...style
    }
  }, dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: 'currentColor',
      flex: 'none'
    }
  }), ic && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: ic,
    size: sm ? 11 : 12,
    strokeWidth: 1.75
  }), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Badge.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Card.jsx
try { (() => {
function Card({
  title,
  count,
  subtitle,
  action,
  variant = 'default',
  padding,
  children,
  style,
  bodyStyle
}) {
  const glass = variant === 'glass';
  const pad = padding ?? (variant === 'compact' ? 16 : 24);
  return /*#__PURE__*/React.createElement("section", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: glass ? 24 : 20,
      minWidth: 0,
      padding: pad,
      background: glass ? 'var(--gradient-glass-card)' : 'var(--surface-card)',
      border: '1px solid ' + (glass ? 'var(--border-glass)' : 'var(--border-1)'),
      borderRadius: glass ? 'var(--radius-2xl)' : 'var(--radius-lg)',
      backdropFilter: glass ? 'blur(var(--blur-glass))' : undefined,
      WebkitBackdropFilter: glass ? 'blur(var(--blur-glass))' : undefined,
      fontFamily: 'var(--font-sans)',
      color: 'var(--fg-1)',
      ...style
    }
  }, (title || action) && /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      minWidth: 0
    }
  }, title && /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontSize: glass ? 24 : 20,
      fontWeight: 500,
      lineHeight: 1.3,
      letterSpacing: '-0.01em'
    }
  }, title, count != null && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 400,
      color: 'var(--fg-2)',
      marginLeft: 6
    }
  }, "(", count, ")")), subtitle && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 14,
      color: 'var(--fg-2)'
    }
  }, subtitle)), action), children != null && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      minWidth: 0,
      ...bodyStyle
    }
  }, children));
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Card.jsx", error: String((e && e.message) || e) }); }

// components/data-display/IconTile.jsx
try { (() => {
const T = {
  brand: ['var(--blue-50)', 'var(--blue-500)'],
  solid: ['var(--blue-500)', 'var(--white)'],
  success: ['var(--green-50)', 'var(--green-700)'],
  warning: ['var(--yellow-100)', 'var(--yellow-800)'],
  danger: ['var(--red-50)', 'var(--red-600)'],
  neutral: ['var(--gray-100)', 'var(--gray-500)']
};
function IconTile({
  icon,
  tone = 'brand',
  size = 40,
  shape = 'square',
  style
}) {
  const t = T[tone] || T.brand;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: size,
      height: size,
      flex: 'none',
      borderRadius: shape === 'circle' ? '50%' : Math.round(size * 0.25),
      background: t[0],
      color: t[1],
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: Math.round(size * 0.5)
  }));
}
Object.assign(__ds_scope, { IconTile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/IconTile.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Legend.jsx
try { (() => {
function Legend({
  items = [],
  layout = 'inline',
  style
}) {
  const stacked = layout === 'stacked';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: stacked ? 28 : 16,
      alignItems: 'flex-start',
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, items.map(it => /*#__PURE__*/React.createElement("div", {
    key: it.label,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 14,
      color: 'var(--fg-2)',
      whiteSpace: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 3,
      background: it.color,
      flex: 'none'
    }
  }), it.label), stacked && it.value != null && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 18,
      fontWeight: 500,
      color: 'var(--fg-1)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, it.value))));
}
Object.assign(__ds_scope, { Legend });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Legend.jsx", error: String((e && e.message) || e) }); }

// components/data-display/ListItem.jsx
try { (() => {
function ListItem({
  leading,
  title,
  titleExtra,
  description,
  meta = [],
  trailing,
  onClick,
  variant = 'card',
  style
}) {
  const [h, setH] = React.useState(false);
  const card = variant === 'card';
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      minWidth: 0,
      padding: card ? '16px 20px' : '14px 0',
      background: card ? onClick && h ? 'var(--surface-hover)' : 'var(--surface-card)' : 'transparent',
      ...(card ? {
        border: '1px solid var(--border-1)',
        borderRadius: 'var(--radius-lg)'
      } : {
        borderBottom: '1px solid var(--border-1)'
      }),
      cursor: onClick ? 'pointer' : 'default',
      fontFamily: 'var(--font-sans)',
      transition: 'background var(--dur-fast) var(--ease-out)',
      ...style
    }
  }, leading, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 500,
      color: 'var(--fg-1)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, title), titleExtra), description && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: 'var(--fg-2)',
      lineHeight: 1.45,
      textWrap: 'pretty'
    }
  }, description), meta.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '4px 16px'
    }
  }, meta.map((m, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      fontSize: 13,
      color: m.color || 'var(--fg-2)',
      whiteSpace: 'nowrap'
    }
  }, m.icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: m.icon,
    size: 14
  }), m.text)))), trailing && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flex: 'none'
    }
  }, trailing));
}
Object.assign(__ds_scope, { ListItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/ListItem.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Pill.jsx
try { (() => {
function Pill({
  variant = 'soft',
  size = 'md',
  active = false,
  onClick,
  children,
  style
}) {
  const md = size === 'md';
  const V = {
    soft: {
      bg: 'linear-gradient(90deg,var(--white) 0%,var(--blue-100) 100%)',
      bd: 'var(--white)',
      fg: 'var(--fg-1)'
    },
    white: {
      bg: 'var(--white)',
      bd: 'var(--white)',
      fg: 'var(--fg-1)'
    },
    outline: {
      bg: 'transparent',
      bd: 'var(--border-1)',
      fg: 'var(--fg-1)'
    },
    brand: {
      bg: 'var(--blue-500)',
      bd: 'var(--blue-500)',
      fg: 'var(--fg-on-brand)'
    }
  };
  const v = V[active ? 'brand' : variant] || V.soft;
  return /*#__PURE__*/React.createElement("span", {
    onClick: onClick,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: md ? 40 : 28,
      padding: md ? '0 20px' : '0 12px',
      borderRadius: 'var(--radius-full)',
      background: v.bg,
      border: '1px solid ' + v.bd,
      color: v.fg,
      fontFamily: 'var(--font-sans)',
      fontSize: md ? 16 : 13,
      lineHeight: 1,
      whiteSpace: 'nowrap',
      cursor: onClick ? 'pointer' : 'default',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Pill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Pill.jsx", error: String((e && e.message) || e) }); }

// components/data-display/ProgressBar.jsx
try { (() => {
function ProgressBar({
  value = 0,
  max = 100,
  label,
  valueLabel,
  tone = 'brand',
  height = 6,
  style
}) {
  const pct = Math.max(0, Math.min(100, max ? value / max * 100 : 0));
  const fill = {
    brand: 'var(--blue-500)',
    success: 'var(--green-500)',
    warning: 'var(--yellow-500)',
    danger: 'var(--red-500)',
    orange: 'var(--orange-500)'
  }[tone] || 'var(--blue-500)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      minWidth: 0,
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, (label || valueLabel) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 8,
      fontSize: 14,
      color: 'var(--fg-1)'
    }
  }, /*#__PURE__*/React.createElement("span", null, label), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--fg-2)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, valueLabel)), /*#__PURE__*/React.createElement("div", {
    style: {
      height,
      borderRadius: 999,
      background: 'var(--chart-track)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: pct + '%',
      height: '100%',
      borderRadius: 999,
      background: fill,
      transition: 'width var(--dur-slow) var(--ease-out)'
    }
  })));
}
Object.assign(__ds_scope, { ProgressBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/ProgressBar.jsx", error: String((e && e.message) || e) }); }

// components/data-display/StatCard.jsx
try { (() => {
const IC = {
  default: 'var(--blue-500)',
  brand: 'var(--blue-500)',
  success: 'var(--green-500)',
  warning: 'var(--yellow-800)',
  danger: 'var(--red-500)',
  orange: 'var(--orange-500)',
  neutral: 'var(--gray-500)'
};
function StatCard({
  label,
  value,
  icon,
  tone = 'default',
  trend,
  trendValue,
  caption,
  selected = false,
  onClick,
  style
}) {
  const [h, setH] = React.useState(false);
  return /*#__PURE__*/React.createElement("section", {
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      minWidth: 0,
      padding: '16px 16px 18px',
      background: 'var(--surface-card)',
      border: '1px solid ' + (selected ? 'var(--border-brand)' : onClick && h ? 'var(--border-2)' : 'var(--border-1)'),
      boxShadow: selected ? '0 0 0 1px var(--border-brand)' : 'none',
      borderRadius: 'var(--radius-lg)',
      fontFamily: 'var(--font-sans)',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'border-color var(--dur-fast) var(--ease-out)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      color: 'var(--fg-1)'
    }
  }, label), icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 22,
    color: IC[tone] || IC.default
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 28,
      fontWeight: 500,
      lineHeight: 1.15,
      letterSpacing: '-0.01em',
      color: 'var(--fg-1)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, value), trend && /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    trend: trend
  }, trendValue)), caption && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: 'var(--fg-2)'
    }
  }, caption));
}
Object.assign(__ds_scope, { StatCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/StatCard.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Table.jsx
try { (() => {
function Table({
  columns = [],
  rows = [],
  divided = false,
  dense = false,
  onRowClick,
  emptyText = 'Nada por aqui ainda.',
  style
}) {
  const [hov, setHov] = React.useState(-1);
  const cellPad = dense ? '8px 0' : '12px 0';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      overflowX: 'auto',
      overflowY: 'hidden',
      ...style
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, columns.map((c, i) => /*#__PURE__*/React.createElement("th", {
    key: c.key,
    style: {
      textAlign: c.align || 'left',
      fontSize: 14,
      fontWeight: 400,
      color: 'var(--fg-2)',
      padding: '0 0 8px',
      paddingRight: i < columns.length - 1 ? 16 : 0,
      width: c.width,
      whiteSpace: 'nowrap',
      borderBottom: divided ? '1px solid var(--border-1)' : 0
    }
  }, c.label)))), /*#__PURE__*/React.createElement("tbody", null, rows.length === 0 && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: columns.length,
    style: {
      padding: '24px 0',
      textAlign: 'center',
      color: 'var(--fg-2)',
      fontSize: 14
    }
  }, emptyText)), rows.map((r, ri) => /*#__PURE__*/React.createElement("tr", {
    key: r.id ?? ri,
    onClick: onRowClick ? () => onRowClick(r) : undefined,
    onMouseEnter: () => setHov(ri),
    onMouseLeave: () => setHov(-1),
    style: {
      cursor: onRowClick ? 'pointer' : 'default',
      background: onRowClick && hov === ri ? 'var(--surface-hover)' : 'transparent'
    }
  }, columns.map((c, i) => /*#__PURE__*/React.createElement("td", {
    key: c.key,
    style: {
      textAlign: c.align || 'left',
      fontSize: 16,
      color: 'var(--fg-1)',
      padding: cellPad,
      paddingRight: i < columns.length - 1 ? 16 : 0,
      borderBottom: divided ? '1px solid var(--border-1)' : 0,
      fontVariantNumeric: 'tabular-nums',
      whiteSpace: 'nowrap'
    }
  }, c.render ? c.render(r) : r[c.key])))))));
}
Object.assign(__ds_scope, { Table });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Table.jsx", error: String((e && e.message) || e) }); }

// components/data-display/UserChip.jsx
try { (() => {
function UserChip({
  name,
  subtitle,
  src,
  size = 44,
  chevron = false,
  onClick,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 12,
      cursor: onClick ? 'pointer' : 'default',
      fontFamily: 'var(--font-sans)',
      minWidth: 0,
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    src: src,
    name: name,
    size: size
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: size >= 56 ? 20 : 15,
      fontWeight: 500,
      color: 'var(--fg-1)',
      lineHeight: 1.2,
      whiteSpace: 'nowrap'
    }
  }, name), subtitle && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: size >= 56 ? 16 : 12,
      color: 'var(--fg-2)',
      lineHeight: 1.3,
      whiteSpace: 'nowrap'
    }
  }, subtitle)), chevron && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: 18,
    color: "var(--fg-1)",
    style: {
      marginLeft: 8
    }
  }));
}
Object.assign(__ds_scope, { UserChip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/UserChip.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Banner.jsx
try { (() => {
const T = {
  brand: ['var(--blue-50)', 'var(--blue-700)', 'info'],
  success: ['var(--green-50)', 'var(--green-700)', 'circle-check'],
  warning: ['var(--yellow-50)', 'var(--yellow-800)', 'triangle-alert'],
  danger: ['var(--red-50)', 'var(--red-600)', 'circle-alert']
};
function Banner({
  tone = 'brand',
  icon,
  children,
  action,
  onAction,
  style
}) {
  const t = T[tone] || T.brand;
  return /*#__PURE__*/React.createElement("div", {
    role: "status",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 16px',
      borderRadius: 'var(--radius-md)',
      background: t[0],
      color: t[1],
      fontFamily: 'var(--font-sans)',
      fontSize: 14,
      lineHeight: 1.4,
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon || t[2],
    size: 18
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      color: 'var(--fg-1)'
    }
  }, children), action && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onAction,
    style: {
      padding: 0,
      border: 0,
      background: 'transparent',
      color: 'var(--blue-500)',
      fontFamily: 'inherit',
      fontSize: 14,
      fontWeight: 500,
      cursor: 'pointer',
      whiteSpace: 'nowrap'
    }
  }, action));
}
Object.assign(__ds_scope, { Banner });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Banner.jsx", error: String((e && e.message) || e) }); }

// components/feedback/EmptyState.jsx
try { (() => {
function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      padding: '32px 16px',
      textAlign: 'center',
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.IconTile, {
    icon: icon,
    tone: "neutral",
    size: 48,
    shape: "circle"
  }), title && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 500,
      color: 'var(--fg-1)'
    }
  }, title), description && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: 'var(--fg-2)',
      maxWidth: 360,
      textWrap: 'pretty'
    }
  }, description), action && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, action));
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/feedback/FeedItem.jsx
try { (() => {
function FeedItem({
  icon = 'circle',
  tone = 'brand',
  children,
  time,
  last = false,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.IconTile, {
    icon: icon,
    tone: tone,
    size: 32,
    shape: "circle"
  }), !last && /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      width: 1,
      minHeight: 12,
      background: 'var(--border-1)',
      margin: '4px 0'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      paddingBottom: last ? 0 : 16,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: 'var(--fg-1)',
      lineHeight: 1.45,
      textWrap: 'pretty'
    }
  }, children), time && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--fg-2)'
    }
  }, time)));
}
Object.assign(__ds_scope, { FeedItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/FeedItem.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Stepper.jsx
try { (() => {
function Stepper({
  steps = [],
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, steps.map((s, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, i > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 16,
      height: 1,
      background: s.done ? 'var(--blue-300)' : 'var(--border-1)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 12,
      color: s.done ? 'var(--blue-500)' : 'var(--fg-2)',
      whiteSpace: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      boxSizing: 'border-box',
      background: s.done ? 'var(--blue-500)' : 'transparent',
      border: s.done ? 0 : '1.5px solid var(--gray-300)'
    }
  }), s.label))));
}
Object.assign(__ds_scope, { Stepper });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Stepper.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function Input({
  label,
  labelExtra,
  placeholder,
  value,
  defaultValue,
  onChange,
  icon,
  trailingIcon,
  onTrailingClick,
  size = 'lg',
  type = 'text',
  disabled = false,
  readOnly = false,
  invalid = false,
  hint,
  width,
  style
}) {
  const [f, setF] = React.useState(false);
  const h = size === 'md' ? 40 : 48;
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      width: width || '100%',
      fontFamily: 'var(--font-sans)'
    }
  }, (label || labelExtra) && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 8,
      fontSize: 14,
      color: 'var(--fg-2)',
      lineHeight: 1.3
    }
  }, /*#__PURE__*/React.createElement("span", null, label), labelExtra), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      height: h,
      padding: '0 14px',
      background: disabled || readOnly ? 'var(--surface-sunken)' : 'var(--surface-card)',
      border: '1px solid ' + (invalid ? 'var(--red-500)' : f ? 'var(--border-brand)' : 'var(--border-1)'),
      borderRadius: 'var(--radius-md)',
      boxShadow: f ? 'var(--focus-ring)' : 'none',
      transition: 'border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
      ...style
    }
  }, icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 18,
    color: "var(--fg-1)"
  }), /*#__PURE__*/React.createElement("input", {
    type: type,
    placeholder: placeholder,
    value: value,
    defaultValue: defaultValue,
    onChange: onChange,
    disabled: disabled,
    readOnly: readOnly,
    onFocus: () => setF(true),
    onBlur: () => setF(false),
    style: {
      flex: 1,
      minWidth: 0,
      height: '100%',
      border: 0,
      outline: 0,
      background: 'transparent',
      fontFamily: 'inherit',
      fontSize: size === 'md' ? 14 : 16,
      color: disabled || readOnly ? 'var(--fg-2)' : 'var(--fg-1)'
    }
  }), trailingIcon && /*#__PURE__*/React.createElement("span", {
    onClick: onTrailingClick,
    style: {
      display: 'flex',
      cursor: onTrailingClick ? 'pointer' : 'default',
      color: 'var(--fg-2)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: trailingIcon,
    size: 18
  }))), hint && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: invalid ? 'var(--red-600)' : 'var(--fg-2)'
    }
  }, hint));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function Select({
  label,
  options = [],
  value,
  defaultValue,
  onChange,
  placeholder,
  size = 'lg',
  icon,
  disabled = false,
  width,
  style
}) {
  const [f, setF] = React.useState(false);
  const h = size === 'md' ? 40 : 48;
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      width: width || '100%',
      fontFamily: 'var(--font-sans)'
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: 'var(--fg-2)',
      lineHeight: 1.3
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      height: h,
      background: 'var(--surface-card)',
      border: '1px solid ' + (f ? 'var(--border-brand)' : 'var(--border-1)'),
      borderRadius: 'var(--radius-md)',
      boxShadow: f ? 'var(--focus-ring)' : 'none',
      opacity: disabled ? .5 : 1,
      ...style
    }
  }, icon && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 12,
      display: 'flex',
      pointerEvents: 'none'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 16,
    color: "var(--fg-1)"
  })), /*#__PURE__*/React.createElement("select", {
    value: value,
    defaultValue: value === undefined ? defaultValue ?? (placeholder ? '' : undefined) : undefined,
    onChange: onChange,
    disabled: disabled,
    onFocus: () => setF(true),
    onBlur: () => setF(false),
    style: {
      appearance: 'none',
      WebkitAppearance: 'none',
      width: '100%',
      height: '100%',
      border: 0,
      outline: 0,
      background: 'transparent',
      padding: '0 40px 0 ' + (icon ? 36 : 14) + 'px',
      fontFamily: 'inherit',
      fontSize: size === 'md' ? 14 : 16,
      color: 'var(--fg-1)',
      cursor: 'pointer'
    }
  }, placeholder && /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, placeholder), options.map(o => {
    const opt = typeof o === 'string' ? {
      value: o,
      label: o
    } : o;
    return /*#__PURE__*/React.createElement("option", {
      key: opt.value,
      value: opt.value
    }, opt.label);
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      right: 14,
      display: 'flex',
      pointerEvents: 'none'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: 18,
    color: "var(--fg-1)"
  }))));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/SettingRow.jsx
try { (() => {
function SettingRow({
  icon,
  title,
  description,
  control,
  children,
  boxed = true,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      background: boxed ? 'var(--surface-card)' : 'transparent',
      border: boxed ? '1px solid var(--border-1)' : 0,
      borderRadius: boxed ? 'var(--radius-lg)' : 0,
      overflow: 'hidden',
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: boxed ? '20px 24px' : '12px 0'
    }
  }, icon && /*#__PURE__*/React.createElement(__ds_scope.IconTile, {
    icon: icon
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 500,
      color: 'var(--fg-1)'
    }
  }, title), description && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: 'var(--fg-2)',
      lineHeight: 1.45,
      textWrap: 'pretty'
    }
  }, description)), control), children && /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--border-1)'
    }
  }, children));
}
Object.assign(__ds_scope, { SettingRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/SettingRow.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function Switch({
  checked,
  defaultChecked = false,
  onChange,
  disabled = false,
  size = 'md',
  label
}) {
  const [inner, setInner] = React.useState(defaultChecked);
  const on = checked !== undefined ? checked : inner;
  const W = size === 'sm' ? 32 : 40,
    H = size === 'sm' ? 18 : 24,
    K = H - 6;
  const toggle = () => {
    if (disabled) return;
    const n = !on;
    if (checked === undefined) setInner(n);
    onChange && onChange(n);
  };
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    role: "switch",
    "aria-checked": on,
    "aria-label": label,
    disabled: disabled,
    onClick: toggle,
    style: {
      position: 'relative',
      width: W,
      height: H,
      flex: 'none',
      padding: 0,
      border: 0,
      borderRadius: 999,
      background: on ? 'var(--blue-500)' : 'var(--gray-300)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? .5 : 1,
      transition: 'background var(--dur-base) var(--ease-out)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 3,
      left: on ? W - K - 3 : 3,
      width: K,
      height: K,
      borderRadius: '50%',
      background: 'var(--white)',
      boxShadow: '0 1px 3px rgba(19,16,28,.2)',
      transition: 'left var(--dur-base) var(--ease-out)'
    }
  }));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/navigation/NavItem.jsx
try { (() => {
function NavItem({
  icon,
  label,
  active = false,
  variant = 'main',
  badge,
  onClick
}) {
  const [h, setH] = React.useState(false);
  const sub = variant === 'sub';
  const bg = active ? sub ? 'var(--blue-50)' : 'var(--blue-500)' : h ? 'var(--gray-100)' : 'transparent';
  const fg = active ? sub ? 'var(--blue-500)' : 'var(--fg-on-brand)' : 'var(--fg-1)';
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    "aria-current": active ? 'page' : undefined,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      width: '100%',
      height: sub ? 40 : 48,
      padding: '0 12px',
      border: 0,
      borderRadius: 'var(--radius-md)',
      background: bg,
      color: fg,
      fontFamily: 'var(--font-sans)',
      fontSize: sub ? 15 : 16,
      fontWeight: active && sub ? 500 : 400,
      textAlign: 'left',
      cursor: 'pointer',
      transition: 'background var(--dur-fast) var(--ease-out)'
    }
  }, icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 20
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, label), badge != null && /*#__PURE__*/React.createElement("span", {
    style: {
      minWidth: 20,
      height: 20,
      padding: '0 6px',
      borderRadius: 999,
      background: active && !sub ? 'rgba(255,255,255,.25)' : 'var(--blue-50)',
      color: active && !sub ? '#fff' : 'var(--blue-500)',
      fontSize: 12,
      lineHeight: '20px',
      textAlign: 'center'
    }
  }, badge));
}
Object.assign(__ds_scope, { NavItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/NavItem.jsx", error: String((e && e.message) || e) }); }

// components/navigation/PageHeader.jsx
try { (() => {
function PageHeader({
  title,
  subtitle,
  actions,
  back,
  onBack,
  info,
  status,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, back && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onBack,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      padding: 0,
      border: 0,
      background: 'transparent',
      color: 'var(--fg-2)',
      fontFamily: 'inherit',
      fontSize: 14,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "arrow-left",
    size: 16
  }), back), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 16,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      minWidth: 0,
      flex: '1 1 320px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: 24,
      fontWeight: 500,
      lineHeight: 1.2,
      letterSpacing: '-0.01em',
      color: 'var(--fg-1)'
    }
  }, title), info && /*#__PURE__*/React.createElement("span", {
    title: info,
    style: {
      display: 'inline-flex',
      color: 'var(--fg-2)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "info",
    size: 18
  })), status), subtitle && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 15,
      color: 'var(--fg-2)',
      lineHeight: 1.4
    }
  }, subtitle)), actions && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap'
    }
  }, actions)));
}
Object.assign(__ds_scope, { PageHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/PageHeader.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Pagination.jsx
try { (() => {
function Pagination({
  page = 1,
  pageCount = 1,
  onChange,
  summary,
  style
}) {
  const go = p => {
    if (p >= 1 && p <= pageCount && onChange) onChange(p);
  };
  const pages = [];
  for (let p = 1; p <= pageCount; p++) {
    if (p === 1 || p === pageCount || Math.abs(p - page) <= 1) pages.push(p);else if (pages[pages.length - 1] !== '…') pages.push('…');
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: 'var(--fg-2)'
    }
  }, summary), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "chevron-left",
    label: "Anterior",
    size: "sm",
    shape: "square",
    disabled: page <= 1,
    onClick: () => go(page - 1)
  }), pages.map((p, i) => p === '…' ? /*#__PURE__*/React.createElement("span", {
    key: 'e' + i,
    style: {
      width: 24,
      textAlign: 'center',
      color: 'var(--fg-2)',
      fontSize: 14
    }
  }, "\u2026") : /*#__PURE__*/React.createElement("button", {
    key: p,
    type: "button",
    onClick: () => go(p),
    "aria-current": p === page ? 'page' : undefined,
    style: {
      minWidth: 32,
      height: 32,
      padding: '0 8px',
      borderRadius: 'var(--radius-md)',
      border: '1px solid ' + (p === page ? 'var(--blue-500)' : 'var(--border-1)'),
      background: p === page ? 'var(--blue-500)' : 'var(--surface-card)',
      color: p === page ? '#fff' : 'var(--fg-1)',
      fontFamily: 'inherit',
      fontSize: 14,
      cursor: 'pointer'
    }
  }, p)), /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "chevron-right",
    label: "Pr\xF3xima",
    size: "sm",
    shape: "square",
    disabled: page >= pageCount,
    onClick: () => go(page + 1)
  })));
}
Object.assign(__ds_scope, { Pagination });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Pagination.jsx", error: String((e && e.message) || e) }); }

// components/navigation/SegmentedControl.jsx
try { (() => {
function SegmentedControl({
  options = [],
  value,
  onChange,
  size = 'md',
  style
}) {
  const sm = size === 'sm';
  return /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 2,
      padding: 3,
      background: 'var(--gray-50)',
      border: '1px solid var(--border-1)',
      borderRadius: 12,
      fontFamily: 'var(--font-sans)',
      maxWidth: '100%',
      overflowX: 'auto',
      scrollbarWidth: 'none',
      ...style
    }
  }, options.map(o => {
    const opt = typeof o === 'string' ? {
      value: o,
      label: o
    } : o;
    const on = opt.value === value;
    return /*#__PURE__*/React.createElement("button", {
      key: opt.value,
      type: "button",
      role: "tab",
      "aria-selected": on,
      onClick: () => onChange && onChange(opt.value),
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: sm ? 30 : 36,
        padding: sm ? '0 12px' : '0 16px',
        border: '1px solid ' + (on ? 'var(--border-1)' : 'transparent'),
        borderRadius: 9,
        background: on ? 'var(--surface-card)' : 'transparent',
        boxShadow: on ? 'var(--shadow-xs)' : 'none',
        color: on ? 'var(--fg-1)' : 'var(--fg-2)',
        fontFamily: 'inherit',
        fontSize: sm ? 13 : 14,
        fontWeight: on ? 500 : 400,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        transition: 'color var(--dur-fast) var(--ease-out)'
      }
    }, opt.icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: opt.icon,
      size: 16
    }), opt.label);
  }));
}
Object.assign(__ds_scope, { SegmentedControl });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/SegmentedControl.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Sidebar.jsx
try { (() => {
function Sidebar({
  items = [],
  sections = [],
  activeId,
  onSelect,
  footer,
  collapsed = false,
  style
}) {
  const groups = sections.length ? sections : [{
    items
  }];
  return /*#__PURE__*/React.createElement("aside", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 28,
      width: collapsed ? 80 : 'var(--sidebar-w)',
      flex: 'none',
      height: '100%',
      padding: '24px 16px',
      boxSizing: 'border-box',
      background: 'var(--surface-app)',
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      height: 32,
      padding: '0 8px'
    }
  }, collapsed ? /*#__PURE__*/React.createElement(__ds_scope.Logo, {
    kind: "mark",
    height: 32
  }) : /*#__PURE__*/React.createElement(__ds_scope.Logo, {
    height: 30
  })), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
      flex: 1,
      minHeight: 0,
      overflowY: 'auto'
    }
  }, groups.map((g, gi) => /*#__PURE__*/React.createElement("div", {
    key: gi,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, g.label && !collapsed && /*#__PURE__*/React.createElement("span", {
    style: {
      padding: '0 12px 6px',
      fontSize: 13,
      fontWeight: 500,
      color: 'var(--fg-2)',
      letterSpacing: '0.04em',
      textTransform: 'uppercase'
    }
  }, g.label), g.items.map(it => /*#__PURE__*/React.createElement(__ds_scope.NavItem, {
    key: it.id,
    icon: it.icon,
    label: collapsed ? '' : it.label,
    badge: collapsed ? undefined : it.badge,
    active: it.id === activeId,
    onClick: () => onSelect && onSelect(it.id)
  }))))), footer);
}
Object.assign(__ds_scope, { Sidebar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Sidebar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function Tabs({
  items = [],
  value,
  onChange,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    style: {
      display: 'flex',
      gap: 28,
      borderBottom: '1px solid var(--border-1)',
      fontFamily: 'var(--font-sans)',
      overflowX: 'auto',
      ...style
    }
  }, items.map(o => {
    const it = typeof o === 'string' ? {
      value: o,
      label: o
    } : o;
    const on = it.value === value;
    return /*#__PURE__*/React.createElement("button", {
      key: it.value,
      type: "button",
      role: "tab",
      "aria-selected": on,
      onClick: () => onChange && onChange(it.value),
      style: {
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 40,
        padding: '0 4px',
        border: 0,
        background: 'transparent',
        color: on ? 'var(--fg-1)' : 'var(--fg-2)',
        fontFamily: 'inherit',
        fontSize: 15,
        fontWeight: on ? 500 : 400,
        cursor: 'pointer',
        whiteSpace: 'nowrap'
      }
    }, it.label, it.count != null && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: 'var(--fg-2)'
      }
    }, "(", it.count, ")"), on && /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: -1,
        height: 2,
        borderRadius: 2,
        background: 'var(--blue-500)'
      }
    }));
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Topbar.jsx
try { (() => {
function Topbar({
  left,
  userName,
  userRole,
  userSrc,
  notifications = false,
  onMenu,
  onMessages,
  onNotifications,
  onUser,
  actions,
  style
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      height: 'var(--header-h)',
      padding: '0 24px',
      borderBottom: '1px solid var(--border-1)',
      background: 'var(--surface-card)',
      fontFamily: 'var(--font-sans)',
      flex: 'none',
      ...style
    }
  }, onMenu && /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "menu",
    label: "Recolher menu",
    variant: "ghost",
    size: "md",
    onClick: onMenu
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flex: 1,
      minWidth: 0
    }
  }, left), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, actions, /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "message-square-text",
    label: "Mensagens",
    onClick: onMessages
  }), /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "bell",
    label: "Notifica\xE7\xF5es",
    dot: notifications,
    onClick: onNotifications
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 1,
      height: 32,
      background: 'var(--border-1)'
    }
  }), /*#__PURE__*/React.createElement(__ds_scope.UserChip, {
    name: userName,
    subtitle: userRole,
    src: userSrc,
    chevron: true,
    onClick: onUser
  }));
}
Object.assign(__ds_scope, { Topbar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Topbar.jsx", error: String((e && e.message) || e) }); }

// scratch/ds-dev.js
try { (() => {
/* DEV ONLY: compiles component sources in-browser when _ds_bundle.js is not built yet. */
(function () {
  var NS = 'YospDesignSystem_33aece';
  if (window[NS]) return;
  var root = document.currentScript.src.split('/scratch/')[0] + '/components/';
  var files = ['brand/Logo', 'brand/Icon', 'actions/Button', 'actions/IconButton', 'data-display/Badge', 'data-display/Avatar', 'data-display/IconTile', 'data-display/Pill', 'data-display/Card', 'data-display/StatCard', 'data-display/Table', 'data-display/UserChip', 'data-display/Legend', 'data-display/ProgressBar', 'data-display/ListItem', 'forms/Input', 'forms/Select', 'forms/Switch', 'forms/SettingRow', 'navigation/NavItem', 'navigation/Sidebar', 'navigation/SegmentedControl', 'navigation/Tabs', 'navigation/Pagination', 'navigation/Topbar', 'navigation/PageHeader', 'feedback/Banner', 'feedback/EmptyState', 'feedback/FeedItem', 'feedback/Stepper'];
  var R = {};
  window[NS] = R;
  files.forEach(function (f) {
    var x = new XMLHttpRequest();
    x.open('GET', root + f + '.jsx?v=' + Date.now(), false);
    x.send();
    if (x.status !== 200) {
      console.warn('ds-dev: missing', f);
      return;
    }
    var src = x.responseText;
    var deps = [];
    src = src.replace(/^import\s+React.*$/mg, '').replace(/^import\s*\{([^}]+)\}\s*from\s*['"][^'"]+['"];?$/mg, function (_, n) {
      deps = deps.concat(n.split(',').map(function (s) {
        return s.trim();
      }));
      return '';
    });
    var ex = [];
    src = src.replace(/export function (\w+)/g, function (_, n) {
      ex.push(n);
      return 'function ' + n;
    });
    var code = '(function(){' + (deps.length ? 'var ' + deps.map(function (d) {
      return d + '=R.' + d;
    }).join(',') + ';' : '') + src + '\n' + ex.map(function (n) {
      return 'R.' + n + '=' + n + ';';
    }).join('') + '})()';
    var out = Babel.transform(code, {
      presets: ['react']
    }).code;
    new Function('React', 'R', out)(React, R);
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "scratch/ds-dev.js", error: String((e && e.message) || e) }); }

// ui_kits/yosp-web/Agenda.jsx
try { (() => {
const DSa = window.YospDesignSystem_33aece;
function AgendaListScreen() {
  const {
    PageHeader,
    Button,
    Card,
    Input,
    Select,
    Pill,
    Table,
    Badge,
    Icon,
    Pagination,
    IconTile
  } = DSa;
  const D = window.YOSP_DATA;
  const [chip, setChip] = React.useState('3d');
  const [page, setPage] = React.useState(1);
  const chips = [['todos', 'Todos'], ['anteriores', 'Anteriores'], ['hoje', 'Hoje'], ['amanha', 'Amanhã'], ['3d', 'Próximos 3 dias'], ['30d', 'Próximos 30 dias']];
  const cols = [{
    key: 'date',
    label: 'Data',
    width: 120,
    render: r => /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(IconTile, {
      icon: "calendar-check",
      size: 36
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 500
      }
    }, r.date), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: 'var(--fg-2)'
      }
    }, r.time)))
  }, {
    key: 'imovel',
    label: 'Imóvel',
    render: r => /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 500
      }
    }, r.imovel), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: 'var(--fg-2)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "map-pin",
      size: 13
    }), r.end))
  }, {
    key: 'servico',
    label: 'Serviço',
    render: r => /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 15
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "circle-check",
      size: 15,
      color: "var(--fg-2)"
    }), r.servico)
  }, {
    key: 'prestador',
    label: 'Prestador',
    render: r => r.prestador ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 15
      }
    }, r.prestador) : /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 15,
        color: 'var(--red-600)'
      }
    }, "N\xE3o atribu\xEDdo")
  }, {
    key: 'status',
    label: 'Status',
    align: 'right',
    render: r => /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(Badge, {
      tone: r.tone
    }, r.status), /*#__PURE__*/React.createElement(Icon, {
      name: "chevron-right",
      size: 18,
      color: "var(--fg-2)"
    }))
  }];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Agendas",
    subtitle: "Gerencie as vistorias de limpeza",
    actions: /*#__PURE__*/React.createElement(Button, {
      size: "lg",
      iconLeft: "plus"
    }, "Novo agendamento")
  }), /*#__PURE__*/React.createElement(Card, {
    padding: 20
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr) minmax(0,1fr)',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Buscar",
    icon: "search",
    placeholder: "Profissionais ou especialidades\u2026"
  }), /*#__PURE__*/React.createElement(Select, {
    label: "Status",
    options: ['Todos', 'Confirmado', 'Aguardando confirmação', 'Cancelado']
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Per\xEDodo",
    icon: "calendar",
    placeholder: "Per\xEDodo personalizado\u2026"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flexWrap: 'wrap',
      paddingTop: 16,
      borderTop: '1px solid var(--border-1)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, chips.map(([v, l]) => /*#__PURE__*/React.createElement(Pill, {
    key: v,
    size: "sm",
    variant: "outline",
    active: chip === v,
    onClick: () => setChip(v)
  }, l))), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: 'var(--fg-2)'
    }
  }, "Resultados ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--fg-1)',
      fontWeight: 500,
      fontSize: 18,
      marginLeft: 6
    }
  }, "32")), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    iconLeft: "download"
  }, "Exportar dados filtrados"))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(Table, {
    columns: cols,
    rows: D.agendamentos,
    divided: true,
    onRowClick: () => {}
  }), /*#__PURE__*/React.createElement(Pagination, {
    page: page,
    pageCount: 3,
    onChange: setPage,
    summary: "Exibindo 1\u201315 de 32 agendamentos"
  })));
}
const CAL_DAYS = [['28', 'Seg'], ['29', 'Ter'], ['30', 'Qua'], ['1', 'Qui'], ['2', 'Sex'], ['3', 'Sáb'], ['4', 'Dom']];
const CAL_TODAY = 3;
const CAL_START = 9,
  CAL_END = 18,
  CAL_ROW = 64;
const CAL_IMOVEIS = ['Higienópolis Clássico', 'Tatuapé Praça Silvio Romero', 'Apto Itaim Executivo', 'Lapa Clélia', 'Apartamento Executivo 44', 'Apartamento Executivo 41', 'Apartamento Executivo 24', 'Apartamento Executivo 35', 'Jardins Alameda Lorena', 'Studio Paulista', 'Butantã USP', 'Brooklin Family 3Q', 'Santana Norte Flat', 'Up Town Duplex'];
const CAL_PREST = ['Ana Paula Ferreira', 'Cláudia Santos', 'Rosângela Oliveira', 'Juliana Costa', 'Marcos Almeida', 'Maria da Silva', 'Sem prestador atribuído', 'Joana Limpeza'];
const CAL_TONES = ['brand', 'brand', 'brand', 'warning', 'danger', 'success', 'brand', 'warning'];
function calEvents() {
  const ev = [];
  let n = 0;
  const slots = [[1, '10:00', 60], [1, '10:30', 60], [1, '11:00', 60], [1, '12:45', 75], [0, '14:00', 60], [0, '15:00', 60], [0, '17:00', 60], [1, '14:00', 60], [1, '15:00', 60], [1, '16:30', 60], [2, '13:00', 60], [2, '13:15', 60], [2, '14:15', 60], [2, '15:15', 60], [2, '16:30', 60], [3, '13:00', 60], [3, '14:00', 60], [3, '15:15', 60], [3, '16:15', 60], [4, '13:00', 60], [4, '14:00', 60], [4, '15:15', 60], [4, '16:15', 60], [5, '13:00', 60], [5, '14:00', 60], [5, '15:15', 60], [5, '16:15', 60], [6, '13:00', 60], [6, '14:00', 60], [6, '15:15', 60], [6, '16:15', 60]];
  slots.forEach(([d, t, dur]) => {
    ev.push({
      d,
      t,
      dur,
      i: n,
      tone: CAL_TONES[n % CAL_TONES.length]
    });
    n++;
  });
  return ev;
}
const toMin = t => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
function WeekCalendar({
  by
}) {
  const {
    Icon
  } = DSa;
  const names = by === 'prestadores' ? CAL_PREST : CAL_IMOVEIS;
  const events = React.useMemo(calEvents, []);
  const TONE = {
    brand: ['var(--blue-50)', 'var(--blue-700)'],
    warning: ['var(--yellow-100)', 'var(--yellow-800)'],
    danger: ['var(--red-50)', 'var(--red-600)'],
    success: ['var(--green-50)', 'var(--green-700)']
  };
  const layout = dayEv => {
    const sorted = [...dayEv].sort((a, b) => toMin(a.t) - toMin(b.t));
    const lanes = [];
    sorted.forEach(e => {
      const s = toMin(e.t);
      let l = lanes.findIndex(end => end <= s);
      if (l < 0) {
        l = lanes.length;
        lanes.push(0);
      }
      lanes[l] = s + e.dur;
      e.lane = l;
    });
    sorted.forEach(e => {
      const s = toMin(e.t),
        en = s + e.dur;
      e.cols = Math.max(...sorted.filter(o => toMin(o.t) < en && toMin(o.t) + o.dur > s).map(o => o.lane)) + 1;
    });
    return sorted;
  };
  const hours = [];
  for (let h = CAL_START; h <= CAL_END; h++) hours.push(h);
  const nowTop = (13 * 60 + 39 - CAL_START * 60) / 60 * CAL_ROW;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      border: '1px solid var(--border-1)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      background: 'var(--surface-card)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '64px repeat(7, minmax(0,1fr))',
      borderBottom: '1px solid var(--border-1)'
    }
  }, /*#__PURE__*/React.createElement("span", null), CAL_DAYS.map(([n, w], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 6,
      padding: '14px 12px',
      borderLeft: '1px solid var(--border-1)',
      color: i === CAL_TODAY ? 'var(--blue-500)' : i === 6 ? 'var(--red-600)' : 'var(--fg-2)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 22,
      fontWeight: i === CAL_TODAY ? 500 : 300,
      color: i === CAL_TODAY ? 'var(--blue-500)' : i < CAL_TODAY ? 'var(--fg-3)' : 'var(--fg-1)'
    }
  }, n), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13
    }
  }, w)))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'grid',
      gridTemplateColumns: '64px repeat(7, minmax(0,1fr))',
      height: (CAL_END - CAL_START) * CAL_ROW,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, hours.map(h => /*#__PURE__*/React.createElement("span", {
    key: h,
    style: {
      position: 'absolute',
      top: h === CAL_START ? 4 : (h - CAL_START) * CAL_ROW - 7,
      right: 10,
      fontSize: 11,
      color: 'var(--fg-2)'
    }
  }, h, ":00"))), CAL_DAYS.map((_, di) => /*#__PURE__*/React.createElement("div", {
    key: di,
    style: {
      position: 'relative',
      borderLeft: '1px solid var(--border-1)',
      background: di === CAL_TODAY ? 'rgba(232,238,254,.45)' : 'transparent'
    }
  }, hours.slice(1).map(h => /*#__PURE__*/React.createElement("span", {
    key: h,
    style: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: (h - CAL_START) * CAL_ROW,
      borderTop: '1px solid var(--gray-100)'
    }
  })), layout(events.filter(e => e.d === di)).map(e => {
    const top = (toMin(e.t) - CAL_START * 60) / 60 * CAL_ROW,
      h = e.dur / 60 * CAL_ROW - 3,
      t = TONE[e.tone];
    return /*#__PURE__*/React.createElement("div", {
      key: e.i,
      title: e.t + ' ' + names[e.i % names.length],
      style: {
        position: 'absolute',
        top: top + 1,
        height: h,
        left: 'calc(' + e.lane / e.cols * 100 + '% + 3px)',
        width: 'calc(' + 100 / e.cols + '% - 6px)',
        padding: '5px 7px',
        borderRadius: 6,
        background: t[0],
        color: t[1],
        fontSize: 12,
        lineHeight: 1.3,
        overflow: 'hidden',
        cursor: 'pointer',
        boxSizing: 'border-box'
      }
    }, /*#__PURE__*/React.createElement("b", {
      style: {
        fontWeight: 600
      }
    }, e.t), " ", names[e.i % names.length]);
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 64,
      right: 0,
      top: nowTop,
      borderTop: '1px dashed var(--blue-500)',
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 8,
      top: nowTop - 8,
      fontSize: 11,
      color: 'var(--blue-500)',
      fontWeight: 500
    }
  }, "13:39")));
}
function AgendaCalendarScreen({
  by
}) {
  const {
    PageHeader,
    Button,
    Card,
    Input,
    Select,
    IconButton,
    SegmentedControl,
    Icon
  } = DSa;
  const [view, setView] = React.useState('semana');
  const isP = by === 'prestadores';
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageHeader, {
    title: isP ? 'Agenda de prestadores' : 'Agenda de imóveis',
    subtitle: isP ? 'Visualize e gerencie os agendamentos por prestador.' : 'Visualize e gerencie os agendamentos por imóvel.',
    actions: /*#__PURE__*/React.createElement(Button, {
      size: "lg",
      iconLeft: "plus"
    }, "Novo agendamento")
  }), /*#__PURE__*/React.createElement(Card, {
    padding: 20
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr) minmax(0,1fr)',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Buscar",
    icon: "search",
    placeholder: isP ? 'Buscar prestadores…' : 'Buscar imóveis…'
  }), /*#__PURE__*/React.createElement(Select, {
    label: "Status",
    options: ['Todos', 'Confirmado', 'Aguardando confirmação', 'Atrasado']
  }), /*#__PURE__*/React.createElement(Select, {
    label: isP ? 'Prestador' : 'Grupo',
    options: isP ? ['Todos', 'Ana Paula Ferreira', 'Cláudia Santos'] : ['Todos', 'Padrão', 'Geral']
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flexWrap: 'wrap',
      paddingTop: 16,
      borderTop: '1px solid var(--border-1)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      height: 42,
      padding: '0 4px',
      border: '1px solid var(--border-1)',
      borderRadius: 'var(--radius-md)'
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    icon: "chevron-left",
    label: "Semana anterior",
    variant: "ghost",
    size: "sm"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 500,
      minWidth: 160,
      textAlign: 'center'
    }
  }, "28 set \u2013 4 out 2026"), /*#__PURE__*/React.createElement(IconButton, {
    icon: "chevron-right",
    label: "Pr\xF3xima semana",
    variant: "ghost",
    size: "sm"
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary"
  }, "Hoje"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 14,
      color: 'var(--fg-2)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "triangle-alert",
    size: 16,
    color: "var(--red-500)"
  }), "Urgentes ", /*#__PURE__*/React.createElement("b", {
    style: {
      fontSize: 18,
      fontWeight: 500,
      color: 'var(--fg-1)'
    }
  }, "3")), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 14,
      color: 'var(--fg-2)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "calendar-days",
    size: 16,
    color: "var(--blue-500)"
  }), "Vis\xEDveis ", /*#__PURE__*/React.createElement("b", {
    style: {
      fontSize: 18,
      fontWeight: 500,
      color: 'var(--fg-1)'
    }
  }, "97")), /*#__PURE__*/React.createElement(SegmentedControl, {
    value: view,
    onChange: setView,
    options: [{
      value: 'mes',
      label: 'Mês'
    }, {
      value: 'semana',
      label: 'Semana'
    }, {
      value: 'dia',
      label: 'Dia'
    }]
  }))), /*#__PURE__*/React.createElement(WeekCalendar, {
    by: by
  }));
}
Object.assign(window, {
  AgendaListScreen,
  AgendaCalendarScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/yosp-web/Agenda.jsx", error: String((e && e.message) || e) }); }

// ui_kits/yosp-web/App.jsx
try { (() => {
function YospApp() {
  const parse = () => {
    const [p, s] = (location.hash.replace('#', '') || 'dashboard').split('/');
    return {
      page: p || 'dashboard',
      sub: s || (window.YOSP_SUBNAV[p] ? window.YOSP_SUBNAV[p][0].value : null)
    };
  };
  const [route, setRoute] = React.useState(parse);
  const [editing, setEditing] = React.useState(false);
  React.useEffect(() => {
    const h = () => setRoute(parse());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  const nav = (page, sub) => {
    setEditing(false);
    location.hash = page + (sub ? '/' + sub : '');
  };
  const {
    page,
    sub
  } = route;
  if (page === 'login') return /*#__PURE__*/React.createElement(LoginScreen, {
    onLogin: () => nav('dashboard')
  });
  const S = (name, props) => {
    const C = window[name];
    return C ? /*#__PURE__*/React.createElement(C, props) : /*#__PURE__*/React.createElement("div", {
      style: {
        padding: 40,
        color: 'var(--fg-2)'
      }
    }, name);
  };
  let body;
  if (page === 'dashboard') body = S('DashboardScreen', {
    onNavigate: nav
  });else if (page === 'agenda') body = sub === 'agendamentos' ? S('AgendaListScreen') : S('AgendaCalendarScreen', {
    by: sub
  });else if (page === 'imoveis') body = sub === 'checklists' ? editing ? S('ChecklistEditScreen', {
    onBack: () => setEditing(false)
  }) : S('ChecklistsScreen', {
    onEdit: () => setEditing(true)
  }) : S('ImoveisScreen');else if (page === 'prestadores') body = sub === 'tipos' ? S('TiposServicoScreen') : S('PrestadoresScreen');else if (page === 'conta') body = S({
    dados: 'DadosContaScreen',
    faturamento: 'FaturamentoScreen',
    usuarios: 'UsuariosScreen',
    logistica: 'LogisticaScreen',
    permissoes: 'PermissoesScreen',
    atividades: 'AtividadesScreen',
    suporte: 'SuporteScreen'
  }[sub] || 'DadosContaScreen');else if (page === 'perfil') body = S('PerfilScreen', {
    onLogout: () => nav('login')
  });
  return /*#__PURE__*/React.createElement(AppShell, {
    page: page,
    sub: sub,
    onNavigate: nav
  }, body);
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(YospApp, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/yosp-web/App.jsx", error: String((e && e.message) || e) }); }

// ui_kits/yosp-web/Conta.jsx
try { (() => {
const DSc = window.YospDesignSystem_33aece;
function PlanCard() {
  const row = (t, v) => /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      padding: '16px 0',
      borderTop: '1px solid rgba(255,255,255,.22)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 500
    }
  }, t), v);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      padding: 24,
      borderRadius: 'var(--radius-lg)',
      background: 'var(--blue-500)',
      color: '#fff',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      paddingBottom: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 18,
      fontWeight: 500
    }
  }, "Yosp"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      opacity: .85
    }
  }, "Resumo da assinatura")), row('Plano Essencial', /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      lineHeight: 1.6,
      opacity: .9
    }
  }, "At\xE9 10 im\xF3veis", /*#__PURE__*/React.createElement("br", null), "Recorr\xEAncia mensal", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("b", {
    style: {
      fontWeight: 500,
      opacity: 1
    }
  }, "R$ 89,90"), " por m\xEAs")), row('Próxima cobrança', /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      opacity: .9
    }
  }, "Assim que a forma de pagamento for confirmada")), row('Forma de pagamento', /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      opacity: .9
    }
  }, "\u2014")), /*#__PURE__*/React.createElement("a", {
    href: "#conta/faturamento",
    style: {
      color: '#fff',
      textDecoration: 'underline',
      fontSize: 14,
      fontWeight: 500,
      paddingTop: 8
    }
  }, "Alterar plano"));
}
function DadosContaScreen() {
  const {
    PageHeader,
    Card,
    Input,
    Select,
    Button,
    SegmentedControl,
    SettingRow,
    Switch,
    Icon
  } = DSc;
  const [tipo, setTipo] = React.useState('pj');
  const g = (cols, kids) => /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: cols,
      gap: 16
    }
  }, kids);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Minha conta",
    subtitle: "Configure os dados e as prefer\xEAncias da sua conta"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 20,
      alignItems: 'flex-start',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Dados da empresa",
    style: {
      flex: '2.4 1 560px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      paddingBottom: 20,
      borderBottom: '1px solid var(--border-1)',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 72,
      height: 72,
      borderRadius: 'var(--radius-lg)',
      border: '1px dashed var(--border-2)',
      background: 'var(--gray-50)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--fg-2)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "image",
    size: 22
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 500
    }
  }, "Logotipo da empresa"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--fg-2)'
    }
  }, "PNG ou SVG, at\xE9 2 MB"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "sm",
    iconLeft: "upload",
    style: {
      alignSelf: 'flex-start'
    }
  }, "Carregar logo")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      alignItems: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: 'var(--fg-2)'
    }
  }, "Tipo de conta"), /*#__PURE__*/React.createElement(SegmentedControl, {
    value: tipo,
    onChange: setTipo,
    options: [{
      value: 'pf',
      label: 'Pessoa física',
      icon: 'user-round'
    }, {
      value: 'pj',
      label: 'Pessoa jurídica',
      icon: 'building'
    }]
  }))), g('1fr 1fr', [/*#__PURE__*/React.createElement(Input, {
    key: "a",
    label: "CNPJ",
    defaultValue: "84.387.155/0001-12"
  }), /*#__PURE__*/React.createElement(Input, {
    key: "b",
    label: "Tenant (ID da conta)",
    defaultValue: "66a1e926-85d1-481b-80b4-e934effc5932",
    readOnly: true
  })]), g('1fr 1fr', [/*#__PURE__*/React.createElement(Input, {
    key: "a",
    label: "Raz\xE3o social",
    defaultValue: "Conta Teste LTDA"
  }), /*#__PURE__*/React.createElement(Input, {
    key: "b",
    label: "Nome fantasia",
    defaultValue: "Conta Teste"
  })]), g('1fr 1fr', [/*#__PURE__*/React.createElement(Input, {
    key: "a",
    label: "E-mail corporativo",
    defaultValue: "contato@contateste.com.br"
  }), /*#__PURE__*/React.createElement(Input, {
    key: "b",
    label: "Telefone comercial",
    defaultValue: "(16) 98540-6837"
  })]), g('200px 1fr', [/*#__PURE__*/React.createElement(Input, {
    key: "a",
    label: "CEP",
    defaultValue: "01529-020"
  }), /*#__PURE__*/React.createElement("span", {
    key: "b"
  })]), g('2fr 120px 1.6fr', [/*#__PURE__*/React.createElement(Input, {
    key: "a",
    label: "Logradouro",
    defaultValue: "Rua Loureiro da Cruz"
  }), /*#__PURE__*/React.createElement(Input, {
    key: "b",
    label: "N\xFAmero",
    defaultValue: "35"
  }), /*#__PURE__*/React.createElement(Input, {
    key: "c",
    label: "Complemento",
    defaultValue: "AP 908"
  })]), g('1fr 1fr 160px', [/*#__PURE__*/React.createElement(Input, {
    key: "a",
    label: "Bairro",
    defaultValue: "Aclima\xE7\xE3o"
  }), /*#__PURE__*/React.createElement(Input, {
    key: "b",
    label: "Cidade",
    defaultValue: "S\xE3o Paulo"
  }), /*#__PURE__*/React.createElement(Select, {
    key: "c",
    label: "UF",
    options: ['SP', 'RJ', 'MG', 'PR']
  })]), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      paddingTop: 20,
      borderTop: '1px solid var(--border-1)'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    iconLeft: "check"
  }, "Salvar altera\xE7\xF5es"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '1 1 300px',
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Prefer\xEAncias"
  }, /*#__PURE__*/React.createElement(SettingRow, {
    boxed: false,
    title: "Tour guiado",
    description: "Exibe dicas interativas ao navegar pelas p\xE1ginas",
    control: /*#__PURE__*/React.createElement(Switch, {
      label: "Tour guiado"
    })
  })), /*#__PURE__*/React.createElement(PlanCard, null))));
}
function FaturamentoScreen() {
  const {
    PageHeader,
    Card,
    Badge,
    Icon,
    Table
  } = DSc;
  const [m, setM] = React.useState(null);
  const opt = (id, ic, l) => /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setM(id),
    style: {
      flex: 1,
      minWidth: 200,
      height: 180,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
      borderRadius: 'var(--radius-lg)',
      border: '1px solid ' + (m === id ? 'var(--border-brand)' : 'var(--border-1)'),
      boxShadow: m === id ? '0 0 0 1px var(--border-brand)' : 'none',
      background: m === id ? 'var(--blue-50)' : 'var(--surface-card)',
      fontFamily: 'inherit',
      fontSize: 18,
      color: 'var(--fg-1)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic,
    size: 40,
    color: "var(--blue-500)",
    strokeWidth: 1.25
  }), l);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Hist\xF3rico de faturamento",
    subtitle: "Acompanhe suas faturas e pagamentos"
  }), /*#__PURE__*/React.createElement(Card, {
    title: "Assinatura",
    action: /*#__PURE__*/React.createElement(Badge, {
      tone: "success",
      dot: true
    }, "Ativa")
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 20,
      flexWrap: 'wrap',
      alignItems: 'stretch'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '2 1 440px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: 'var(--fg-2)'
    }
  }, "Escolha a forma de pagamento"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 16,
      flexWrap: 'wrap'
    }
  }, opt('pix', 'qr-code', 'PIX'), opt('cartao', 'credit-card', 'Cartão de crédito'))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '1 1 300px'
    }
  }, /*#__PURE__*/React.createElement(PlanCard, null)))), /*#__PURE__*/React.createElement(Card, {
    title: "Hist\xF3rico de faturas"
  }, /*#__PURE__*/React.createElement(Table, {
    columns: [{
      key: 'd',
      label: 'Data'
    }, {
      key: 'v',
      label: 'Valor'
    }, {
      key: 's',
      label: 'Status'
    }, {
      key: 'a',
      label: 'Ação',
      align: 'right'
    }],
    rows: [],
    divided: true,
    emptyText: "Nenhuma fatura encontrada"
  })));
}
function UsuariosScreen() {
  const {
    PageHeader,
    Card,
    Table,
    Avatar,
    Badge,
    IconButton,
    Pagination,
    Button
  } = DSc;
  const cols = [{
    key: 'name',
    label: 'Nome',
    render: r => /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      name: r.name,
      tone: r.av,
      size: 36
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 500
      }
    }, r.name), r.you && /*#__PURE__*/React.createElement(Badge, {
      size: "sm"
    }, "Voc\xEA"))
  }, {
    key: 'email',
    label: 'E-mail',
    render: r => /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 15,
        color: r.email === '—' ? 'var(--fg-2)' : 'var(--fg-1)'
      }
    }, r.email)
  }, {
    key: 'nivel',
    label: 'Nível de acesso',
    render: r => /*#__PURE__*/React.createElement(Badge, {
      tone: r.nt
    }, r.nivel)
  }, {
    key: 'status',
    label: 'Status',
    render: r => /*#__PURE__*/React.createElement(Badge, {
      tone: r.st,
      dot: true
    }, r.status)
  }, {
    key: 'acoes',
    label: 'Ações',
    align: 'right',
    render: r => /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(IconButton, {
      icon: "eye",
      label: "Ver",
      size: "md",
      shape: "square"
    }), !r.you && /*#__PURE__*/React.createElement(IconButton, {
      icon: "trash-2",
      label: "Remover",
      size: "md",
      shape: "square"
    }))
  }];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Usu\xE1rios",
    info: "Pessoas com acesso ao painel",
    subtitle: "Gerencie os membros da sua equipe e seus n\xEDveis de acesso",
    actions: /*#__PURE__*/React.createElement(Button, {
      size: "lg",
      iconLeft: "plus"
    }, "Adicionar usu\xE1rio")
  }), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(Table, {
    columns: cols,
    rows: window.YOSP_DATA.usuarios,
    divided: true
  }), /*#__PURE__*/React.createElement(Pagination, {
    page: 1,
    pageCount: 1,
    summary: "Mostrando 4 de 4 usu\xE1rios"
  })));
}
function LogisticaScreen() {
  const {
    PageHeader,
    SettingRow,
    Switch,
    Banner,
    Button,
    ListItem,
    Badge,
    IconButton
  } = DSc;
  const [grp, setGrp] = React.useState(true);
  const dot = c => /*#__PURE__*/React.createElement("span", {
    style: {
      width: 12,
      height: 12,
      borderRadius: 4,
      background: c,
      flex: 'none'
    }
  });
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Log\xEDstica e invent\xE1rio",
    subtitle: "Configure lavanderia, estrat\xE9gia de estoque e agrupamento de im\xF3veis."
  }), /*#__PURE__*/React.createElement(SettingRow, {
    icon: "calendar-check",
    title: "Confirma\xE7\xE3o de agendamento",
    description: "O prestador recebe uma notifica\xE7\xE3o e precisa confirmar data e hora antes do agendamento virar Confirmado.",
    control: /*#__PURE__*/React.createElement(Switch, {
      label: "Confirma\xE7\xE3o de agendamento"
    })
  }), /*#__PURE__*/React.createElement(SettingRow, {
    icon: "washing-machine",
    title: "Gest\xE3o de lavanderia",
    description: "Como o enxoval \xE9 processado em todos os im\xF3veis. M\xF3dulo opcional.",
    control: /*#__PURE__*/React.createElement(Switch, {
      label: "Gest\xE3o de lavanderia"
    })
  }), /*#__PURE__*/React.createElement(SettingRow, {
    icon: "folders",
    title: "Agrupamento de im\xF3veis",
    description: "Organize seus im\xF3veis em grupos para facilitar a gest\xE3o. Cada im\xF3vel pertence a apenas um grupo.",
    control: /*#__PURE__*/React.createElement(Switch, {
      checked: grp,
      onChange: setGrp,
      label: "Agrupamento de im\xF3veis"
    })
  }, grp && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      padding: 24
    }
  }, /*#__PURE__*/React.createElement(Banner, null, "Im\xF3veis organizados em grupos. Cada grupo pode ter nome, descri\xE7\xE3o e cor."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 18,
      fontWeight: 500
    }
  }, "Grupos"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: 'var(--fg-2)'
    }
  }, "Pelo menos um grupo deve existir quando o agrupamento est\xE1 ativo.")), /*#__PURE__*/React.createElement(Button, {
    iconLeft: "plus"
  }, "Novo grupo")), /*#__PURE__*/React.createElement(ListItem, {
    leading: dot('var(--gray-400)'),
    title: "Padr\xE3o",
    titleExtra: /*#__PURE__*/React.createElement(Badge, {
      size: "sm"
    }, "Padr\xE3o"),
    meta: [{
      icon: 'house',
      text: '42 imóveis'
    }],
    trailing: /*#__PURE__*/React.createElement(IconButton, {
      icon: "pencil",
      label: "Editar",
      size: "md",
      shape: "square"
    })
  }), /*#__PURE__*/React.createElement(ListItem, {
    leading: dot('var(--orange-500)'),
    title: "Geral",
    meta: [{
      icon: 'house',
      text: '15 imóveis'
    }],
    trailing: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(IconButton, {
      icon: "pencil",
      label: "Editar",
      size: "md",
      shape: "square"
    }), /*#__PURE__*/React.createElement(IconButton, {
      icon: "trash-2",
      label: "Excluir",
      size: "md",
      shape: "square"
    }))
  }))));
}
function PermissoesScreen() {
  const {
    PageHeader,
    Card,
    Switch,
    Icon,
    Badge
  } = DSc;
  const roles = ['Administrador', 'Anfitrião', 'Dono do imóvel'];
  const th = {
    textAlign: 'center',
    padding: '14px 12px',
    fontSize: 14,
    fontWeight: 400,
    color: 'var(--fg-2)',
    borderBottom: '1px solid var(--border-1)'
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Permiss\xF5es de acesso",
    subtitle: "Controle quais m\xF3dulos e a\xE7\xF5es cada perfil de usu\xE1rio pode acessar.",
    actions: /*#__PURE__*/React.createElement(Badge, {
      icon: "shield-check",
      style: {
        height: 32,
        padding: '0 12px',
        fontSize: 13
      }
    }, "Propriet\xE1rio da conta sempre tem acesso irrestrito")
  }), /*#__PURE__*/React.createElement(Card, {
    padding: 0,
    style: {
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    style: {
      ...th,
      textAlign: 'left',
      paddingLeft: 24
    }
  }, "M\xF3dulo / a\xE7\xE3o"), /*#__PURE__*/React.createElement("th", {
    style: {
      ...th,
      background: 'var(--blue-50)',
      color: 'var(--blue-700)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "lock",
    size: 14
  }), "Propriet\xE1rio da conta")), roles.map(r => /*#__PURE__*/React.createElement("th", {
    key: r,
    style: th
  }, r)))), /*#__PURE__*/React.createElement("tbody", null, window.YOSP_DATA.permissoes.map(m => /*#__PURE__*/React.createElement(React.Fragment, {
    key: m.mod
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: 5,
    style: {
      padding: '10px 24px',
      background: 'var(--gray-50)',
      fontSize: 14,
      fontWeight: 500,
      borderBottom: '1px solid var(--border-1)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: m.icon,
    size: 16,
    color: "var(--blue-500)"
  }), m.mod))), m.rows.map(r => /*#__PURE__*/React.createElement("tr", {
    key: r[0]
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 24px 10px 48px',
      fontSize: 15,
      borderBottom: '1px solid var(--border-1)'
    }
  }, r[0]), /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: 'center',
      background: 'rgba(232,238,254,.4)',
      borderBottom: '1px solid var(--border-1)'
    }
  }, /*#__PURE__*/React.createElement(Switch, {
    size: "sm",
    checked: true,
    disabled: true,
    label: "Irrestrito"
  })), [1, 2, 3].map(k => /*#__PURE__*/React.createElement("td", {
    key: k,
    style: {
      textAlign: 'center',
      borderBottom: '1px solid var(--border-1)'
    }
  }, /*#__PURE__*/React.createElement(Switch, {
    size: "sm",
    defaultChecked: !!r[k],
    label: m.mod + ' ' + r[0]
  })))))))))));
}
function AtividadesScreen() {
  const {
    PageHeader,
    Card,
    Select,
    Input,
    Button,
    Table,
    Badge,
    Pagination,
    Icon
  } = DSc;
  const [page, setPage] = React.useState(1);
  const rows = window.YOSP_DATA.atividades.map((a, i) => ({
    id: i,
    when: a[0],
    who: a[1],
    prest: a[2],
    acao: a[3],
    tone: a[4]
  }));
  const cols = [{
    key: 'when',
    label: 'Quando',
    render: r => /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14,
        fontVariantNumeric: 'tabular-nums'
      }
    }, r.when)
  }, {
    key: 'who',
    label: 'Quem',
    render: r => /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 15
      }
    }, r.who, r.prest && /*#__PURE__*/React.createElement(Badge, {
      tone: "neutral",
      size: "sm"
    }, "Prestador"))
  }, {
    key: 'acao',
    label: 'Ação',
    render: r => /*#__PURE__*/React.createElement(Badge, {
      tone: r.tone
    }, r.acao)
  }, {
    key: 'mod',
    label: 'Módulo',
    render: () => /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 15
      }
    }, "Agendamento")
  }, {
    key: 'det',
    label: 'Detalhes',
    align: 'right',
    render: () => /*#__PURE__*/React.createElement("a", {
      href: "#conta/atividades",
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 14
      }
    }, "Ver", /*#__PURE__*/React.createElement(Icon, {
      name: "chevron-down",
      size: 14
    }))
  }];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Atividades da conta",
    subtitle: "Hist\xF3rico de cria\xE7\xF5es, edi\xE7\xF5es e remo\xE7\xF5es feitas por todos os usu\xE1rios da conta"
  }), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, minmax(0,1fr)) auto',
      gap: 16,
      alignItems: 'end',
      paddingBottom: 20,
      borderBottom: '1px solid var(--border-1)'
    }
  }, /*#__PURE__*/React.createElement(Select, {
    label: "M\xF3dulo",
    options: ['Todos', 'Agendamento', 'Imóveis', 'Usuários']
  }), /*#__PURE__*/React.createElement(Select, {
    label: "A\xE7\xE3o",
    options: ['Todas', 'Criação', 'Mudança de status', 'Atribuição', 'Cancelamento']
  }), /*#__PURE__*/React.createElement(Input, {
    label: "De",
    type: "date"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "At\xE9",
    type: "date"
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "lg",
    iconLeft: "filter-x"
  }, "Limpar")), /*#__PURE__*/React.createElement(Table, {
    columns: cols,
    rows: rows,
    divided: true,
    dense: true
  }), /*#__PURE__*/React.createElement(Pagination, {
    page: page,
    pageCount: 3,
    onChange: setPage,
    summary: "78 atividades"
  })));
}
function SuporteScreen() {
  const {
    PageHeader,
    Card,
    ListItem,
    IconTile,
    Badge,
    Icon,
    Button
  } = DSc;
  const big = (icon, tone, t, d, badge) => /*#__PURE__*/React.createElement(ListItem, {
    onClick: () => {},
    leading: /*#__PURE__*/React.createElement(IconTile, {
      icon: icon,
      tone: tone,
      size: 56
    }),
    title: /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 18
      }
    }, t),
    description: /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        alignItems: 'flex-start'
      }
    }, d, badge),
    trailing: /*#__PURE__*/React.createElement(Icon, {
      name: "arrow-right",
      size: 20,
      color: "var(--fg-2)"
    }),
    style: {
      flex: '1 1 380px',
      padding: 24
    }
  });
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Suporte",
    subtitle: "Escolha a melhor forma de entrar em contato com nossa equipe."
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 20,
      flexWrap: 'wrap'
    }
  }, big('ticket', 'success', 'Abrir chamado', 'Registre sua solicitação e acompanhe o andamento. Respondemos em até 24 horas.', /*#__PURE__*/React.createElement(Badge, null, "Resposta em at\xE9 24 h")), big('message-square-text', 'brand', 'Chat ao vivo', 'Converse em tempo real com nossa equipe. Disponível em dias úteis, das 9h às 18h.', /*#__PURE__*/React.createElement(Badge, {
    tone: "success",
    dot: true
  }, "Online agora"))), /*#__PURE__*/React.createElement(Card, {
    title: "Meus chamados",
    action: /*#__PURE__*/React.createElement(Button, {
      variant: "soft",
      iconLeft: "plus"
    }, "Novo chamado")
  }, /*#__PURE__*/React.createElement(ListItem, {
    variant: "plain",
    onClick: () => {},
    title: /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--fg-2)',
        fontWeight: 400,
        marginRight: 8
      }
    }, "#9"), "Teste de novo chamado aberto"),
    trailing: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Badge, {
      tone: "orange",
      dot: true
    }, "Aguardando usu\xE1rio"), /*#__PURE__*/React.createElement(Badge, {
      tone: "warning"
    }, "Prioridade alta"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: 'var(--fg-2)',
        width: 80,
        textAlign: 'right'
      }
    }, "17/08/2026"), /*#__PURE__*/React.createElement(Icon, {
      name: "chevron-right",
      size: 18,
      color: "var(--fg-2)"
    })),
    style: {
      borderBottom: 0
    }
  })));
}
Object.assign(window, {
  PlanCard,
  DadosContaScreen,
  FaturamentoScreen,
  UsuariosScreen,
  LogisticaScreen,
  PermissoesScreen,
  AtividadesScreen,
  SuporteScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/yosp-web/Conta.jsx", error: String((e && e.message) || e) }); }

// ui_kits/yosp-web/Dashboard.jsx
try { (() => {
const DSd = window.YospDesignSystem_33aece;
function DashboardScreen({
  onNavigate
}) {
  const {
    PageHeader,
    Badge,
    Button,
    StatCard,
    Banner,
    Card,
    ProgressBar,
    Icon,
    Avatar,
    Legend,
    EmptyState,
    FeedItem
  } = DSd;
  const D = window.YOSP_DATA;
  const [filter, setFilter] = React.useState('hoje');
  const rows = D.faxinasHoje.filter(f => filter === 'hoje' || filter === 'atrasadas' && f.tone === 'danger' || filter === 'semprestador' && !f.prestador || filter === 'andamento' && f.tone === 'orange' || filter === 'concluidas' && f.tone === 'success');
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Opera\xE7\xE3o de hoje",
    subtitle: /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement(Badge, {
      tone: "success",
      dot: true
    }, "Ao vivo"), "atualizado \xE0s 08:38"),
    actions: /*#__PURE__*/React.createElement(Button, {
      size: "lg",
      iconLeft: "calendar-days",
      onClick: () => onNavigate('agenda', 'agendamentos')
    }, "Abrir agenda")
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(190px,1fr))',
      gap: 20
    }
  }, D.kpis.map(k => /*#__PURE__*/React.createElement(StatCard, {
    key: k.id,
    label: k.label,
    value: k.value,
    icon: k.icon,
    tone: k.tone,
    caption: k.caption,
    selected: filter === k.id,
    onClick: () => setFilter(k.id)
  }))), /*#__PURE__*/React.createElement(Banner, {
    icon: "calendar-days",
    action: "Ver agenda",
    onAction: () => onNavigate('agenda', 'agendamentos')
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, "Amanh\xE3: ", /*#__PURE__*/React.createElement("b", {
    style: {
      fontWeight: 500
    }
  }, "8 agendamentos"), /*#__PURE__*/React.createElement(Badge, {
    tone: "warning"
  }, "1 sem prestador"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 20,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Faxinas de hoje",
    count: rows.length,
    style: {
      flex: '1.75 1 560px'
    }
  }, /*#__PURE__*/React.createElement("div", null, rows.length === 0 && /*#__PURE__*/React.createElement(EmptyState, {
    icon: "calendar-check",
    title: "Nada por aqui",
    description: "Nenhuma faxina corresponde a este filtro."
  }), rows.map((f, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 20,
      padding: '14px 0',
      borderTop: i ? '1px solid var(--border-1)' : 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 56,
      flex: 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 500,
      fontVariantNumeric: 'tabular-nums'
    }
  }, f.time), f.late && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--red-600)'
    }
  }, f.late)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 500
    }
  }, f.imovel), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '4px 16px',
      fontSize: 13,
      color: 'var(--fg-2)'
    }
  }, f.prestador ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "user-round",
    size: 14
  }), f.prestador) : /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      color: 'var(--orange-700)',
      fontWeight: 500,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "user-x",
    size: 14
  }), "Sem prestador \xB7 atribuir"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "spray-can",
    size: 14
  }), f.servico), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      color: 'var(--red-600)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "camera",
    size: 14
  }), f.fotos, " fotos pendentes"))), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 150,
      flex: 'none',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: f.tone
  }, f.status), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement(ProgressBar, {
    value: f.done,
    max: 32,
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--fg-2)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, f.done, "/32"))))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      flex: '1 1 340px',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Im\xF3veis no mapa"
  }, /*#__PURE__*/React.createElement(MapPlaceholder, {
    height: 200,
    label: "Mapa dos im\xF3veis (Google Maps)"
  }), /*#__PURE__*/React.createElement(Legend, {
    items: [{
      label: 'Pendente',
      color: 'var(--orange-500)'
    }, {
      label: 'Agendada',
      color: 'var(--blue-500)'
    }, {
      label: 'Sem agendamento',
      color: 'var(--gray-300)'
    }]
  })), /*#__PURE__*/React.createElement(Card, {
    title: "Equipe em campo",
    count: D.equipe.length
  }, /*#__PURE__*/React.createElement("div", null, D.equipe.map((p, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 0',
      borderTop: i ? '1px solid var(--border-1)' : 0
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: p.name,
    size: 36
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 500
    }
  }, p.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--fg-2)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, p.local)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 2,
      fontSize: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--blue-500)'
    }
  }, "em campo h\xE1 ", p.since), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
      color: 'var(--fg-2)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "star",
    size: 12,
    color: "var(--yellow-500)"
  }), p.rating)))))), /*#__PURE__*/React.createElement(Card, {
    title: "Qualidade de hoje"
  }, /*#__PURE__*/React.createElement(EmptyState, {
    icon: "badge-check",
    title: "Nenhuma faxina conclu\xEDda hoje",
    description: "As avalia\xE7\xF5es aparecem aqui assim que a primeira faxina terminar.",
    style: {
      padding: '12px 0'
    }
  })), /*#__PURE__*/React.createElement(Card, {
    title: "Ao vivo"
  }, /*#__PURE__*/React.createElement("div", null, D.feed.map((e, i) => /*#__PURE__*/React.createElement(FeedItem, {
    key: i,
    icon: e.icon,
    tone: e.tone,
    time: e.time,
    last: i === D.feed.length - 1
  }, e.html[0], /*#__PURE__*/React.createElement("b", {
    style: {
      fontWeight: 500
    }
  }, e.html[1]))))))));
}
Object.assign(window, {
  DashboardScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/yosp-web/Dashboard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/yosp-web/Imoveis.jsx
try { (() => {
const DSi = window.YospDesignSystem_33aece;
function ImovelCard({
  im
}) {
  const {
    Badge,
    Icon,
    Button
  } = DSi;
  const [name, addr, status, tone, group] = im;
  const acts = [['clipboard-list', 'Detalhes'], ['list-checks', 'Checklists'], ['package', 'Estoque'], ['history', 'Histórico']];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--surface-card)',
      border: '1px solid var(--border-1)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: 120,
      background: 'var(--gray-50)',
      borderBottom: '1px solid var(--border-1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--fg-3)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "map-pin",
    size: 22,
    color: "var(--blue-500)"
  }), /*#__PURE__*/React.createElement(Badge, {
    tone: tone,
    style: {
      position: 'absolute',
      top: 10,
      right: 10
    }
  }, status)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      padding: '14px 16px 12px',
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 500
    }
  }, name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--fg-2)',
      lineHeight: 1.4
    }
  }, addr, " \xB7 S\xE3o Paulo/SP"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 13,
      color: 'var(--fg-2)',
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "file-text",
    size: 14
  }), "1 template"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "folder",
    size: 14
  }), group))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      borderTop: '1px solid var(--border-1)'
    }
  }, acts.map(([ic, l], i) => /*#__PURE__*/React.createElement("button", {
    key: l,
    type: "button",
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4,
      padding: '10px 0',
      border: 0,
      borderLeft: i ? '1px solid var(--border-1)' : 0,
      background: 'transparent',
      color: 'var(--fg-2)',
      fontFamily: 'inherit',
      fontSize: 12,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic,
    size: 16,
    color: "var(--blue-500)"
  }), l))));
}
function ImoveisScreen() {
  const {
    PageHeader,
    Button,
    Input,
    Select
  } = DSi;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Im\xF3veis",
    subtitle: "Gerencie seu portf\xF3lio de propriedades e configura\xE7\xF5es de auditoria.",
    actions: /*#__PURE__*/React.createElement(Button, {
      size: "lg",
      iconLeft: "plus"
    }, "Novo im\xF3vel")
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr) minmax(0,1fr)',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Input, {
    icon: "search",
    placeholder: "Buscar por nome, endere\xE7o ou refer\xEAncia\u2026"
  }), /*#__PURE__*/React.createElement(Select, {
    options: ['Todos os grupos', 'Padrão', 'Geral']
  }), /*#__PURE__*/React.createElement(Select, {
    options: ['Todos os status', 'Confirmado', 'Concluído', 'Em andamento']
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))',
      gap: 20
    }
  }, window.YOSP_DATA.imoveis.map(im => /*#__PURE__*/React.createElement(ImovelCard, {
    key: im[0],
    im: im
  }))));
}
function ChecklistsScreen({
  onEdit
}) {
  const {
    PageHeader,
    Button,
    Tabs,
    ListItem,
    IconTile,
    IconButton,
    EmptyState
  } = DSi;
  const [tab, setTab] = React.useState('checklists');
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Checklists",
    subtitle: "Gerencie as perguntas de neg\xF3cio e os checklists da sua conta."
  }), /*#__PURE__*/React.createElement(Tabs, {
    value: tab,
    onChange: setTab,
    items: [{
      value: 'checklists',
      label: 'Checklists'
    }, {
      value: 'perguntas',
      label: 'Perguntas'
    }]
  }), tab === 'checklists' ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "lg",
    iconLeft: "sparkles"
  }, "Criar checklist com o assistente"), /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    iconLeft: "plus",
    onClick: onEdit
  }, "Novo checklist")), /*#__PURE__*/React.createElement(ListItem, {
    onClick: onEdit,
    leading: /*#__PURE__*/React.createElement(IconTile, {
      icon: "file-text",
      size: 48
    }),
    title: "Faxina completa do im\xF3vel",
    description: "Checklist de limpeza para sala, cozinha, banheiro e dois quartos. Garanta que todos os ambientes estejam organizados e prontos para os pr\xF3ximos h\xF3spedes.",
    meta: [{
      icon: 'door-open',
      text: '5 cômodos'
    }, {
      icon: 'list-checks',
      text: '28 itens'
    }, {
      icon: 'building-2',
      text: '57 imóveis vinculados'
    }],
    trailing: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(IconButton, {
      icon: "link",
      label: "Copiar link",
      size: "md",
      shape: "square"
    }), /*#__PURE__*/React.createElement(IconButton, {
      icon: "pencil",
      label: "Editar",
      size: "md",
      shape: "square",
      onClick: onEdit
    }), /*#__PURE__*/React.createElement(IconButton, {
      icon: "trash-2",
      label: "Excluir",
      size: "md",
      shape: "square"
    }))
  })) : /*#__PURE__*/React.createElement(EmptyState, {
    icon: "circle-help",
    title: "Nenhuma pergunta de neg\xF3cio",
    description: "Perguntas aparecem no fim de cada faxina, para o prestador responder.",
    action: /*#__PURE__*/React.createElement(Button, {
      iconLeft: "plus"
    }, "Nova pergunta")
  }));
}
function ChecklistEditScreen({
  onBack
}) {
  const {
    PageHeader,
    Button,
    Card,
    Input,
    Select,
    SettingRow,
    Switch,
    NavItem,
    IconButton,
    Icon,
    Tabs
  } = DSi;
  const rooms = [['Sala', 4], ['Cozinha', 6], ['Banheiro', 6], ['Quarto 1', 6], ['Quarto 2', 6]];
  const [room, setRoom] = React.useState('Sala');
  const items = ['Aspirar ou varrer o piso', 'Tirar o pó dos móveis e superfícies', 'Organizar almofadas e mantas', 'Limpar vidros e espelhos'];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Checklists",
    subtitle: "Gerencie as perguntas de neg\xF3cio e os checklists da sua conta."
  }), /*#__PURE__*/React.createElement(Tabs, {
    value: "checklists",
    items: [{
      value: 'checklists',
      label: 'Checklists'
    }, {
      value: 'perguntas',
      label: 'Perguntas'
    }]
  }), /*#__PURE__*/React.createElement(PageHeader, {
    back: "Checklists",
    onBack: onBack,
    title: "Faxina completa do im\xF3vel",
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      size: "lg",
      onClick: onBack
    }, "Cancelar"), /*#__PURE__*/React.createElement(Button, {
      size: "lg",
      iconLeft: "save"
    }, "Salvar"))
  }), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(Input, {
    label: "T\xEDtulo do checklist",
    defaultValue: "Faxina completa do im\xF3vel"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Descri\xE7\xE3o (opcional)",
    defaultValue: "Checklist de limpeza para sala, cozinha, banheiro e dois quartos."
  }), /*#__PURE__*/React.createElement(Select, {
    label: "Servi\xE7o vinculado",
    placeholder: "Nenhum (opcional)",
    options: window.YOSP_DATA.tipos
  }))), /*#__PURE__*/React.createElement(Card, {
    title: "Perguntas de neg\xF3cio",
    subtitle: "Respondidas pelo prestador ao finalizar a faxina."
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SettingRow, {
    boxed: false,
    title: "Todos os equipamentos est\xE3o em ordem?",
    control: /*#__PURE__*/React.createElement(Switch, {
      label: "Ativar pergunta"
    })
  }), /*#__PURE__*/React.createElement(SettingRow, {
    boxed: false,
    title: "N\xEDvel de sujeira do local",
    description: "1 pouco sujo \xB7 5 muito sujo",
    control: /*#__PURE__*/React.createElement(Switch, {
      defaultChecked: true,
      label: "Ativar pergunta"
    })
  }))), /*#__PURE__*/React.createElement(Card, {
    title: "C\xF4modos e itens"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '260px minmax(0,1fr)',
      gap: 20,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      padding: 8,
      border: '1px solid var(--border-1)',
      borderRadius: 'var(--radius-lg)'
    }
  }, rooms.map(([r, n]) => /*#__PURE__*/React.createElement(NavItem, {
    key: r,
    variant: "sub",
    icon: "grip-vertical",
    label: r,
    badge: n,
    active: room === r,
    onClick: () => setRoom(r)
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    iconLeft: "plus",
    style: {
      color: 'var(--blue-500)',
      marginTop: 4
    }
  }, "Adicionar c\xF4modo")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Nome do c\xF4modo",
    value: room,
    onChange: () => {},
    icon: "door-open"
  }), items.map((it, i) => /*#__PURE__*/React.createElement("div", {
    key: it,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      padding: 16,
      border: '1px solid var(--border-1)',
      borderRadius: 'var(--radius-lg)',
      background: 'var(--surface-card)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "grip-vertical",
    size: 16,
    color: "var(--fg-3)"
  }), /*#__PURE__*/React.createElement(Input, {
    defaultValue: it,
    size: "md"
  }), /*#__PURE__*/React.createElement(IconButton, {
    icon: "copy",
    label: "Duplicar",
    variant: "ghost",
    size: "sm"
  }), /*#__PURE__*/React.createElement(IconButton, {
    icon: "trash-2",
    label: "Excluir",
    variant: "ghost",
    size: "sm"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingLeft: 26
    }
  }, /*#__PURE__*/React.createElement(SettingRow, {
    boxed: false,
    title: "Foto obrigat\xF3ria",
    description: "Exige ao menos uma foto para concluir este item.",
    control: /*#__PURE__*/React.createElement(Switch, {
      size: "sm",
      defaultChecked: i === 0,
      label: "Foto obrigat\xF3ria"
    })
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: 0,
      border: 0,
      background: 'transparent',
      color: 'var(--blue-500)',
      fontFamily: 'inherit',
      fontSize: 14,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 14
  }), "Adicionar instru\xE7\xF5es"))))))));
}
Object.assign(window, {
  ImoveisScreen,
  ChecklistsScreen,
  ChecklistEditScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/yosp-web/Imoveis.jsx", error: String((e && e.message) || e) }); }

// ui_kits/yosp-web/Perfil.jsx
try { (() => {
const DSf = window.YospDesignSystem_33aece;
function PerfilScreen({
  onLogout
}) {
  const {
    PageHeader,
    Card,
    Avatar,
    Badge,
    Input,
    Button,
    SettingRow,
    Switch
  } = DSf;
  const u = window.YOSP_DATA.user;
  const [show, setShow] = React.useState({});
  const pw = (k, l) => /*#__PURE__*/React.createElement(Input, {
    key: k,
    label: l,
    type: show[k] ? 'text' : 'password',
    trailingIcon: show[k] ? 'eye-off' : 'eye',
    onTrailingClick: () => setShow({
      ...show,
      [k]: !show[k]
    })
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      maxWidth: 860
    }
  }, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Meu perfil",
    subtitle: "Suas informa\xE7\xF5es pessoais e a seguran\xE7a da conta",
    actions: /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      iconLeft: "log-out",
      onClick: onLogout
    }, "Sair")
  }), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: u.name,
    tone: "solid",
    size: 72
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 22,
      fontWeight: 500
    }
  }, u.name), /*#__PURE__*/React.createElement(Badge, null, u.role)))), /*#__PURE__*/React.createElement(Card, {
    title: "Informa\xE7\xF5es pessoais"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Nome completo",
    defaultValue: u.name,
    readOnly: true
  }), /*#__PURE__*/React.createElement(Input, {
    label: "E-mail",
    defaultValue: u.email,
    readOnly: true
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Telefone",
    defaultValue: "\u2014",
    readOnly: true
  }), /*#__PURE__*/React.createElement(Input, {
    label: "CPF",
    defaultValue: "\u2014",
    readOnly: true
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Membro desde",
    defaultValue: "13 de maio de 2026",
    readOnly: true
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--fg-2)'
    }
  }, "Para alterar estes dados, fale com um administrador da conta.")), /*#__PURE__*/React.createElement(Card, {
    title: "Seguran\xE7a"
  }, pw('a', 'Senha atual'), pw('b', 'Nova senha'), pw('c', 'Confirmar nova senha'), /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    style: {
      alignSelf: 'flex-start'
    }
  }, "Alterar senha")), /*#__PURE__*/React.createElement(Card, {
    title: "Autentica\xE7\xE3o de dois fatores (2FA)"
  }, /*#__PURE__*/React.createElement(SettingRow, {
    boxed: false,
    title: "Exigir c\xF3digo de verifica\xE7\xE3o ao entrar",
    description: "Adiciona uma camada extra de seguran\xE7a usando um aplicativo autenticador.",
    control: /*#__PURE__*/React.createElement(Switch, {
      label: "2FA"
    })
  })), /*#__PURE__*/React.createElement(Card, {
    title: "Login com Google"
  }, /*#__PURE__*/React.createElement(SettingRow, {
    boxed: false,
    title: "Permitir entrar com sua conta Google",
    description: "Desativado por padr\xE3o \u2014 mesmo que sua conta j\xE1 tenha sido usada com Google antes, essa op\xE7\xE3o precisa ser ligada aqui.",
    control: /*#__PURE__*/React.createElement(Switch, {
      defaultChecked: true,
      label: "Login com Google"
    })
  })));
}
function LoginScreen({
  onLogin
}) {
  const {
    Logo,
    Input,
    Button
  } = DSf;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      minHeight: '100vh',
      background: 'var(--surface-card)',
      fontFamily: 'var(--font-sans)'
    },
    "data-screen-label": "login"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '1 1 48%',
      position: 'relative',
      background: 'var(--gray-100) url(../../assets/login-photo.jpg) center/cover no-repeat'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '1 1 52%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40
    }
  }, /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      onLogin();
    },
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      width: '100%',
      maxWidth: 400
    }
  }, /*#__PURE__*/React.createElement(Logo, {
    height: 44,
    style: {
      alignSelf: 'center',
      marginBottom: 24
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: 32,
      fontWeight: 500,
      letterSpacing: '-0.02em'
    }
  }, "Entrar"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      color: 'var(--fg-2)'
    }
  }, "Fa\xE7a login para continuar")), /*#__PURE__*/React.createElement(Input, {
    label: "E-mail",
    defaultValue: "rhamnys@yosp.com.br"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Senha",
    type: "password",
    defaultValue: "segredo123",
    trailingIcon: "eye",
    labelExtra: /*#__PURE__*/React.createElement("a", {
      href: "#login",
      style: {
        fontSize: 14
      }
    }, "Esqueceu sua senha?")
  }), /*#__PURE__*/React.createElement(Button, {
    type: "submit",
    size: "lg",
    fullWidth: true
  }, "Entrar"), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "lg",
    fullWidth: true
  }, "Entrar com link de acesso por e-mail"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      color: 'var(--fg-2)',
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      height: 1,
      background: 'var(--border-1)'
    }
  }), "ou", /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      height: 1,
      background: 'var(--border-1)'
    }
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "lg",
    fullWidth: true
  }, "Continuar com Google"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      gap: 20,
      paddingTop: 24,
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#login",
    style: {
      color: 'var(--fg-2)'
    }
  }, "Pol\xEDtica de privacidade"), /*#__PURE__*/React.createElement("a", {
    href: "#login",
    style: {
      color: 'var(--fg-2)'
    }
  }, "Termos"), /*#__PURE__*/React.createElement("a", {
    href: "#login",
    style: {
      color: 'var(--fg-2)'
    }
  }, "FAQ")))));
}
Object.assign(window, {
  PerfilScreen,
  LoginScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/yosp-web/Perfil.jsx", error: String((e && e.message) || e) }); }

// ui_kits/yosp-web/Prestadores.jsx
try { (() => {
const DSp = window.YospDesignSystem_33aece;
function PrestadoresScreen() {
  const {
    PageHeader,
    Button,
    Card,
    Table,
    Avatar,
    Badge,
    IconButton,
    Stepper,
    Pagination,
    Input
  } = DSp;
  const D = window.YOSP_DATA;
  const cols = [{
    key: 'name',
    label: 'Nome',
    render: r => /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      name: r.name,
      size: 36
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 500
      }
    }, r.name)), /*#__PURE__*/React.createElement(Stepper, {
      steps: [{
        label: 'Convite enviado',
        done: r.steps >= 1
      }, {
        label: 'Senha criada',
        done: r.steps >= 2
      }, {
        label: 'Conta ativada',
        done: r.steps >= 3
      }],
      style: {
        width: 340
      }
    }))
  }, {
    key: 'email',
    label: 'E-mail',
    render: r => /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 15
      }
    }, r.email)
  }, {
    key: 'cel',
    label: 'Celular',
    render: r => /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 15
      }
    }, r.cel)
  }, {
    key: 'cpf',
    label: 'CPF',
    render: r => /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 15,
        color: r.cpf === '—' ? 'var(--fg-2)' : 'var(--fg-1)'
      }
    }, r.cpf)
  }, {
    key: 'status',
    label: 'Status',
    render: r => /*#__PURE__*/React.createElement(Badge, {
      tone: r.status === 'Ativo' ? 'success' : 'warning',
      dot: true
    }, r.status)
  }, {
    key: 'acoes',
    label: 'Ações',
    align: 'right',
    render: () => /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(IconButton, {
      icon: "eye",
      label: "Ver",
      size: "md",
      shape: "square"
    }), /*#__PURE__*/React.createElement(IconButton, {
      icon: "trash-2",
      label: "Remover",
      size: "md",
      shape: "square"
    }))
  }];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Prestadores de servi\xE7o",
    info: "Profissionais que executam faxinas e manuten\xE7\xF5es",
    subtitle: "Gerencie os profissionais vinculados \xE0 sua conta",
    actions: /*#__PURE__*/React.createElement(Button, {
      size: "lg",
      iconLeft: "plus"
    }, "Adicionar prestador")
  }), /*#__PURE__*/React.createElement(Card, {
    title: "Prestadores",
    count: D.prestadores.length,
    action: /*#__PURE__*/React.createElement(Input, {
      icon: "search",
      placeholder: "Buscar prestador",
      size: "md",
      width: 260
    })
  }, /*#__PURE__*/React.createElement(Table, {
    columns: cols,
    rows: D.prestadores,
    divided: true
  }), /*#__PURE__*/React.createElement(Pagination, {
    page: 1,
    pageCount: 1,
    summary: "Mostrando 8 de 8 prestadores"
  })));
}
function TiposServicoScreen() {
  const {
    PageHeader,
    Button,
    Card,
    ListItem,
    IconTile,
    IconButton
  } = DSp;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Tipos de servi\xE7o",
    subtitle: "Configure as categorias de servi\xE7o que sua equipe pode executar"
  }), /*#__PURE__*/React.createElement(Card, {
    title: "Lista de tipos de servi\xE7o",
    subtitle: "Defina os tipos de servi\xE7o dispon\xEDveis para os profissionais da sua conta.",
    action: /*#__PURE__*/React.createElement(Button, {
      size: "lg",
      iconLeft: "plus"
    }, "Novo tipo de servi\xE7o")
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, window.YOSP_DATA.tipos.map(t => /*#__PURE__*/React.createElement(ListItem, {
    key: t,
    leading: /*#__PURE__*/React.createElement(IconTile, {
      icon: "badge-check",
      size: 36
    }),
    title: t,
    trailing: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(IconButton, {
      icon: "eye",
      label: "Ver",
      size: "md",
      shape: "square"
    }), /*#__PURE__*/React.createElement(IconButton, {
      icon: "pencil",
      label: "Editar",
      size: "md",
      shape: "square"
    }), /*#__PURE__*/React.createElement(IconButton, {
      icon: "trash-2",
      label: "Excluir",
      size: "md",
      shape: "square"
    }))
  }))), /*#__PURE__*/React.createElement("span", {
    style: {
      alignSelf: 'flex-end',
      fontSize: 13,
      color: 'var(--fg-2)'
    }
  }, "4 tipos de servi\xE7o cadastrados")));
}
Object.assign(window, {
  PrestadoresScreen,
  TiposServicoScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/yosp-web/Prestadores.jsx", error: String((e && e.message) || e) }); }

// ui_kits/yosp-web/Shell.jsx
try { (() => {
const {
  Sidebar,
  Topbar,
  SegmentedControl
} = window.YospDesignSystem_33aece;
const YOSP_NAV = [{
  id: 'dashboard',
  label: 'Dashboard',
  icon: 'layout-grid'
}, {
  id: 'agenda',
  label: 'Agenda',
  icon: 'calendar-days'
}, {
  id: 'imoveis',
  label: 'Imóveis',
  icon: 'building-2'
}, {
  id: 'prestadores',
  label: 'Prestadores de serviço',
  icon: 'wrench'
}, {
  id: 'conta',
  label: 'Minha conta',
  icon: 'circle-user-round'
}];
const YOSP_SUBNAV = {
  agenda: [{
    value: 'agendamentos',
    label: 'Agendamentos'
  }, {
    value: 'imoveis',
    label: 'Imóveis'
  }, {
    value: 'prestadores',
    label: 'Prestadores'
  }],
  imoveis: [{
    value: 'lista',
    label: 'Imóveis'
  }, {
    value: 'checklists',
    label: 'Checklists'
  }],
  prestadores: [{
    value: 'lista',
    label: 'Prestadores'
  }, {
    value: 'tipos',
    label: 'Tipos de serviço'
  }],
  conta: [{
    value: 'dados',
    label: 'Dados da conta'
  }, {
    value: 'faturamento',
    label: 'Faturamento'
  }, {
    value: 'usuarios',
    label: 'Usuários'
  }, {
    value: 'logistica',
    label: 'Logística'
  }, {
    value: 'permissoes',
    label: 'Permissões'
  }, {
    value: 'atividades',
    label: 'Atividades'
  }, {
    value: 'suporte',
    label: 'Suporte'
  }]
};
function AppShell({
  page,
  sub,
  onNavigate,
  children
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const user = window.YOSP_DATA.user;
  const subs = YOSP_SUBNAV[page];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      height: '100vh',
      background: 'var(--surface-app)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement(Sidebar, {
    items: YOSP_NAV,
    activeId: page === 'perfil' ? null : page,
    collapsed: collapsed,
    onSelect: id => onNavigate(id, YOSP_SUBNAV[id] ? YOSP_SUBNAV[id][0].value : null)
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      margin: '16px 16px 0 0',
      background: 'var(--surface-card)',
      border: '1px solid var(--border-1)',
      borderBottom: 0,
      borderRadius: '16px 16px 0 0',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement(Topbar, {
    onMenu: () => setCollapsed(!collapsed),
    userName: user.name,
    userRole: user.role,
    notifications: true,
    onUser: () => onNavigate('perfil', null),
    left: subs ? /*#__PURE__*/React.createElement(SegmentedControl, {
      size: subs.length > 4 ? 'sm' : 'md',
      value: sub,
      onChange: v => onNavigate(page, v),
      options: subs
    }) : null
  }), /*#__PURE__*/React.createElement("main", {
    "data-screen-label": page + (sub ? ' / ' + sub : ''),
    style: {
      flex: 1,
      minHeight: 0,
      overflowY: 'auto',
      padding: '28px 24px 40px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
      maxWidth: 1360,
      margin: '0 auto'
    }
  }, children))));
}
function MapPlaceholder({
  height = 220,
  label = 'Mapa'
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height,
      borderRadius: 'var(--radius-md)',
      background: 'var(--gray-50)',
      border: '1px dashed var(--border-2)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      color: 'var(--fg-2)',
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement(window.YospDesignSystem_33aece.Icon, {
    name: "map",
    size: 22
  }), label);
}
Object.assign(window, {
  AppShell,
  MapPlaceholder,
  YOSP_NAV,
  YOSP_SUBNAV
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/yosp-web/Shell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/yosp-web/data.js
try { (() => {
window.YOSP_DATA = {
  user: {
    name: 'Rhamnys Tertuliano',
    role: 'Proprietário da conta',
    email: 'rhamnys@yosp.com.br'
  },
  kpis: [{
    id: 'hoje',
    label: 'Faxinas hoje',
    value: 8,
    icon: 'calendar-check',
    tone: 'default',
    caption: 'agendadas para hoje'
  }, {
    id: 'andamento',
    label: 'Em andamento',
    value: 0,
    icon: 'refresh-cw',
    tone: 'orange',
    caption: 'nenhuma no momento'
  }, {
    id: 'concluidas',
    label: 'Concluídas',
    value: 0,
    icon: 'circle-check',
    tone: 'success',
    caption: '0 de 8 faxinas'
  }, {
    id: 'atrasadas',
    label: 'Atrasadas',
    value: 1,
    icon: 'triangle-alert',
    tone: 'danger',
    caption: '+39 min de atraso'
  }, {
    id: 'semprestador',
    label: 'Sem prestador',
    value: 1,
    icon: 'user-x',
    tone: 'warning',
    caption: 'atribuir até 13:00'
  }],
  faxinasHoje: [{
    time: '08:00',
    late: '+39 min',
    imovel: 'Tatuapé Praça Silvio Romero',
    prestador: 'Ana Paula Ferreira',
    servico: 'Limpeza pesada',
    fotos: 8,
    status: 'Atrasada',
    tone: 'danger',
    done: 0
  }, {
    time: '09:00',
    imovel: 'Apartamento Executivo 24',
    prestador: 'Cláudia Santos',
    servico: 'Limpeza pós-hospedagem',
    fotos: 8,
    status: 'Pendente',
    tone: 'warning',
    done: 0
  }, {
    time: '12:30',
    imovel: 'Apartamento Executivo 34',
    prestador: 'Marcos Almeida',
    servico: 'Limpeza pesada',
    fotos: 8,
    status: 'Pendente',
    tone: 'warning',
    done: 0
  }, {
    time: '13:30',
    imovel: 'Apartamento Executivo 21',
    prestador: null,
    servico: 'Limpeza pós-hospedagem',
    fotos: 8,
    status: 'Agendada',
    tone: 'brand',
    done: 0
  }, {
    time: '14:45',
    imovel: 'Brooklin Family 3Q',
    prestador: 'Maria da Silva',
    servico: 'Limpeza urgente',
    fotos: 8,
    status: 'Agendada',
    tone: 'brand',
    done: 0
  }, {
    time: '15:45',
    imovel: 'Apartamento Executivo 37',
    prestador: 'Joana Limpeza',
    servico: 'Zeladoria/manutenção',
    fotos: 8,
    status: 'Pendente',
    tone: 'warning',
    done: 0
  }],
  equipe: [{
    name: 'Maria da Silva',
    local: 'Apartamento 1 quarto · Horácio Lane',
    since: '2 d',
    rating: '4,2'
  }, {
    name: 'Fernanda Rodrigues',
    local: 'Vila Mariana Metrô',
    since: '2 d',
    rating: '4,6'
  }, {
    name: 'Marcos Almeida',
    local: 'Double Tree Park 807',
    since: '2 d',
    rating: '4,4'
  }, {
    name: 'Juliana Costa',
    local: 'Campo Belo Aeroporto',
    since: '2 d',
    rating: '4,5'
  }, {
    name: 'Rosângela Oliveira',
    local: 'Apartamento Executivo 19',
    since: '2 d',
    rating: '4,8'
  }],
  feed: [{
    icon: 'circle-check',
    tone: 'success',
    html: ['Faxina concluída em ', 'Tatuapé Praça Silvio Romero'],
    time: 'há 21 h · 10:40'
  }, {
    icon: 'play',
    tone: 'brand',
    html: ['Faxina iniciada em ', 'Tatuapé Praça Silvio Romero'],
    time: 'há 22 h · 10:38'
  }, {
    icon: 'thumbs-up',
    tone: 'brand',
    html: ['Rosângela Oliveira confirmou o agendamento de ', 'Tatuapé Praça Silvio Romero'],
    time: 'há 2 d · 06:57'
  }, {
    icon: 'user-plus',
    tone: 'neutral',
    html: ['Prestador atribuído em ', 'Tatuapé Praça Silvio Romero'],
    time: 'há 2 d · 06:50'
  }],
  agendamentos: [{
    id: 1,
    date: '01/10',
    time: '11:00',
    imovel: 'Tatuapé Praça Silvio Romero',
    end: 'Rua Tuiuti, 1000',
    servico: 'Faxina completa do imóvel',
    prestador: 'Ana Paula Ferreira',
    status: 'Confirmado',
    tone: 'brand'
  }, {
    id: 2,
    date: '01/10',
    time: '12:00',
    imovel: 'Apartamento Executivo 24',
    end: 'Rua Bela Cintra, 1600',
    servico: 'Faxina completa do imóvel',
    prestador: 'Cláudia Santos',
    status: 'Aguardando confirmação',
    tone: 'warning'
  }, {
    id: 3,
    date: '01/10',
    time: '13:15',
    imovel: 'Jardins Alameda Lorena',
    end: 'Alameda Lorena, 1200',
    servico: 'Faxina completa do imóvel',
    prestador: 'Rosângela Oliveira',
    status: 'Confirmado',
    tone: 'brand'
  }, {
    id: 4,
    date: '01/10',
    time: '14:15',
    imovel: 'Apartamento Executivo 49',
    end: 'Rua Pensilvânia, 400',
    servico: 'Faxina completa do imóvel',
    prestador: 'Juliana Costa',
    status: 'Confirmado',
    tone: 'brand'
  }, {
    id: 5,
    date: '01/10',
    time: '15:30',
    imovel: 'Apartamento Executivo 34',
    end: 'Rua Vergueiro, 2500',
    servico: 'Faxina completa do imóvel',
    prestador: 'Marcos Almeida',
    status: 'Aguardando confirmação',
    tone: 'warning'
  }, {
    id: 6,
    date: '01/10',
    time: '16:30',
    imovel: 'Apartamento Executivo 21',
    end: 'Rua Aspicuelta, 400',
    servico: 'Faxina completa do imóvel',
    prestador: null,
    status: 'Confirmado',
    tone: 'brand'
  }, {
    id: 7,
    date: '01/10',
    time: '17:45',
    imovel: 'Brooklin Family 3Q',
    end: 'Rua Joaquim Nabuco, 150',
    servico: 'Faxina completa do imóvel',
    prestador: 'Maria da Silva',
    status: 'Confirmado',
    tone: 'brand'
  }, {
    id: 8,
    date: '02/10',
    time: '11:00',
    imovel: 'Higienópolis Clássico',
    end: 'Rua Maranhão, 500',
    servico: 'Faxina completa do imóvel',
    prestador: 'Cláudia Santos',
    status: 'Aguardando confirmação',
    tone: 'warning'
  }, {
    id: 9,
    date: '02/10',
    time: '12:00',
    imovel: 'Apartamento Executivo 35',
    end: 'Rua Tutóia, 600',
    servico: 'Faxina completa do imóvel',
    prestador: 'Rosângela Oliveira',
    status: 'Confirmado',
    tone: 'brand'
  }, {
    id: 10,
    date: '02/10',
    time: '15:30',
    imovel: 'Apartamento Executivo 28',
    end: 'Av. Brigadeiro Faria Lima, 2000',
    servico: 'Faxina completa do imóvel',
    prestador: null,
    status: 'Confirmado',
    tone: 'brand'
  }],
  imoveis: [['Apartamento Executivo 50', 'Rua Borges Lagoa, 1000 · Vila Clementino', 'Concluído', 'success', 'Padrão'], ['Apartamento Executivo 22', 'Rua Fradique Coutinho, 700 · Pinheiros', 'Aguardando confirmação', 'warning', 'Padrão'], ['Apartamento Executivo 23', 'Av. Rebouças, 3000 · Pinheiros', 'Confirmado', 'brand', 'Padrão'], ['Apartamento Executivo 24', 'Rua Bela Cintra, 1600 · Consolação', 'Aguardando confirmação', 'warning', 'Padrão'], ['Apartamento Executivo 25', 'Rua Haddock Lobo, 800 · Cerqueira César', 'Confirmado', 'brand', 'Padrão'], ['Apartamento Executivo 26', 'Alameda Santos, 1800 · Cerqueira César', 'Concluído', 'success', 'Padrão'], ['Apartamento Executivo 30', 'Rua Pedroso Alvarenga, 700 · Itaim Bibi', 'Em andamento', 'orange', 'Padrão'], ['Apartamento Executivo 31', 'Av. Moema, 300 · Moema', 'Disputado', 'danger', 'Padrão'], ['Brooklin Family 3Q', 'Rua Joaquim Nabuco, 150 · Brooklin', 'Confirmado', 'brand', 'Geral'], ['Vila Mariana Metrô', 'Rua Domingos de Morais, 1500 · Vila Mariana', 'Em andamento', 'orange', 'Geral'], ['Higienópolis Clássico', 'Rua Maranhão, 500 · Higienópolis', 'Confirmado', 'brand', 'Geral'], ['Lapa Clélia', 'Rua Clélia, 1500 · Lapa', 'Concluído', 'success', 'Padrão']],
  prestadores: [{
    name: 'Ana Paula Ferreira',
    email: 'ana@exemplo.com',
    cel: '(55) 11987-6500',
    cpf: '—',
    status: 'Pendente',
    steps: 1
  }, {
    name: 'Cláudia Santos',
    email: 'claudia@exemplo.com',
    cel: '(55) 11987-6500',
    cpf: '—',
    status: 'Pendente',
    steps: 1
  }, {
    name: 'Fernanda Rodrigues',
    email: 'fernanda@exemplo.com',
    cel: '(55) 11987-6500',
    cpf: '—',
    status: 'Pendente',
    steps: 1
  }, {
    name: 'Juliana Costa',
    email: 'juliana@exemplo.com',
    cel: '(55) 11987-6500',
    cpf: '—',
    status: 'Pendente',
    steps: 1
  }, {
    name: 'Marcos Almeida',
    email: 'marcos@exemplo.com',
    cel: '(55) 11987-6500',
    cpf: '—',
    status: 'Pendente',
    steps: 1
  }, {
    name: 'Maria da Silva',
    email: 'maria.silva@exemplo.com',
    cel: '(11) 94460-7049',
    cpf: '081.536.916-60',
    status: 'Ativo',
    steps: 3
  }, {
    name: 'Rosângela Oliveira',
    email: 'rosangela@exemplo.com',
    cel: '(55) 11987-6500',
    cpf: '—',
    status: 'Pendente',
    steps: 2
  }, {
    name: 'Joana Limpeza',
    email: 'joana@exemplo.com',
    cel: '(11) 90000-0000',
    cpf: '967.762.480-60',
    status: 'Ativo',
    steps: 3
  }],
  tipos: ['Limpeza pesada', 'Limpeza pós-hospedagem', 'Limpeza urgente', 'Zeladoria/manutenção'],
  usuarios: [{
    name: 'Patrícia Liz das Neves',
    email: 'patricia.neves@emcinfo.com.br',
    nivel: 'Administrador',
    nt: 'brand',
    status: 'Pendente',
    st: 'warning',
    av: 'brand'
  }, {
    name: 'Rhamnys Tertuliano',
    email: 'rhamnys@yosp.com.br',
    nivel: 'Proprietário da conta',
    nt: 'brand',
    status: 'Ativo',
    st: 'success',
    av: 'brand',
    you: true
  }, {
    name: 'Leandro Pestana',
    email: 'leandro@exemplo.com',
    nivel: 'Dono do imóvel',
    nt: 'warning',
    status: 'Ativo',
    st: 'success',
    av: 'yellow'
  }, {
    name: 'José da Silva',
    email: '—',
    nivel: 'Dono do imóvel',
    nt: 'warning',
    status: 'Sem acesso',
    st: 'neutral',
    av: 'yellow'
  }],
  atividades: [['30/09/2026, 15:40', 'Rhamnys Tertuliano', false, 'Mudança de status', 'brand'], ['30/09/2026, 15:38', 'Rhamnys Tertuliano', false, 'Mudança de status', 'brand'], ['29/09/2026, 11:57', 'Rosângela Oliveira', true, 'Mudança de status', 'brand'], ['29/09/2026, 11:50', 'Rhamnys Tertuliano', false, 'Atribuição', 'neutral'], ['29/09/2026, 11:48', 'Rhamnys Tertuliano', false, 'Criação', 'success'], ['29/09/2026, 11:40', 'Rhamnys Tertuliano', false, 'Cancelamento', 'danger'], ['29/09/2026, 11:36', 'Cláudia Santos', true, 'Mudança de status', 'brand'], ['29/09/2026, 11:24', 'Fernanda Rodrigues', true, 'Mudança de status', 'brand'], ['29/09/2026, 11:21', 'Rosângela Oliveira', true, 'Mudança de status', 'brand'], ['29/09/2026, 11:20', 'Maria da Silva', true, 'Mudança de status', 'brand']],
  permissoes: [{
    mod: 'Dashboard',
    icon: 'layout-grid',
    rows: [['Visualizar', 1, 1, 1]]
  }, {
    mod: 'Imóveis',
    icon: 'building-2',
    rows: [['Visualizar', 1, 1, 1], ['Criar', 1, 0, 0], ['Editar', 1, 0, 0], ['Excluir', 0, 0, 0]]
  }, {
    mod: 'Checklists',
    icon: 'list-checks',
    rows: [['Visualizar', 1, 1, 1], ['Criar', 0, 0, 0], ['Editar', 0, 0, 0]]
  }, {
    mod: 'Equipe',
    icon: 'users',
    rows: [['Visualizar', 1, 0, 0], ['Criar', 1, 0, 0], ['Editar', 1, 0, 0]]
  }, {
    mod: 'Relatórios',
    icon: 'chart-column',
    rows: [['Visualizar', 0, 0, 1]]
  }, {
    mod: 'Agenda',
    icon: 'calendar-days',
    rows: [['Visualizar', 1, 1, 1]]
  }]
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/yosp-web/data.js", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.Logo = __ds_scope.Logo;

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.IconTile = __ds_scope.IconTile;

__ds_ns.Legend = __ds_scope.Legend;

__ds_ns.ListItem = __ds_scope.ListItem;

__ds_ns.Pill = __ds_scope.Pill;

__ds_ns.ProgressBar = __ds_scope.ProgressBar;

__ds_ns.StatCard = __ds_scope.StatCard;

__ds_ns.Table = __ds_scope.Table;

__ds_ns.UserChip = __ds_scope.UserChip;

__ds_ns.Banner = __ds_scope.Banner;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.FeedItem = __ds_scope.FeedItem;

__ds_ns.Stepper = __ds_scope.Stepper;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.SettingRow = __ds_scope.SettingRow;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.NavItem = __ds_scope.NavItem;

__ds_ns.PageHeader = __ds_scope.PageHeader;

__ds_ns.Pagination = __ds_scope.Pagination;

__ds_ns.SegmentedControl = __ds_scope.SegmentedControl;

__ds_ns.Sidebar = __ds_scope.Sidebar;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.Topbar = __ds_scope.Topbar;

})();
