import { forwardRef } from 'react';

/**
 * Reusable Input component with consistent styling
 */
const Input = forwardRef(({ 
  label, 
  error, 
  helperText, 
  icon: Icon, 
  leftIcon = true,
  className = '', 
  ...props 
}, ref) => {
  const baseClasses = `w-full bg-black border rounded-2xl px-6 py-4 text-white placeholder-zinc-500 focus:outline-none focus:border-red-600 transition ${error ? 'border-red-600' : 'border-zinc-700'}`;
  const iconClasses = Icon ? (leftIcon ? 'pl-12' : 'pr-12') : '';

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-zinc-300">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && leftIcon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
            <Icon size={20} />
          </div>
        )}
        <input 
          ref={ref}
          className={`${baseClasses} ${iconClasses}`}
          {...props} 
        />
        {Icon && !leftIcon && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">
            <Icon size={20} />
          </div>
        )}
      </div>
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-sm text-zinc-500">{helperText}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

/**
 * Reusable TextArea component with consistent styling
 */
const TextArea = forwardRef(({ 
  label, 
  error, 
  helperText, 
  className = '', 
  ...props 
}, ref) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-zinc-300">
          {label}
        </label>
      )}
      <textarea 
        ref={ref}
        className={`w-full bg-black border rounded-2xl px-6 py-4 text-white placeholder-zinc-500 focus:outline-none focus:border-red-600 transition resize-none ${error ? 'border-red-600' : 'border-zinc-700'}`}
        {...props} 
      />
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-sm text-zinc-500">{helperText}</p>
      )}
    </div>
  );
});

TextArea.displayName = 'TextArea';

/**
 * Reusable Select component with consistent styling
 */
const Select = forwardRef(({ 
  label, 
  error, 
  helperText, 
  options = [], 
  className = '', 
  ...props 
}, ref) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-zinc-300">
          {label}
        </label>
      )}
      <select 
        ref={ref}
        className={`w-full bg-black border rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-red-600 transition ${error ? 'border-red-600' : 'border-zinc-700'}`}
        {...props} 
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-sm text-zinc-500">{helperText}</p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export { Input, TextArea, Select };
export default Input;