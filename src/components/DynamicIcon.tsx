import React from 'react';
import * as LucideIcons from 'lucide-react';
import { HelpCircle } from 'lucide-react';

interface DynamicIconProps extends LucideIcons.LucideProps {
    name: string;
}

const DynamicIcon: React.FC<DynamicIconProps> = ({ name, ...props }) => {
    // @ts-expect-error - Lucide icons exist on the module but TS doesn't know exact keys
    const Icon = LucideIcons[name] || HelpCircle;

    return <Icon {...props} />;
};

export default DynamicIcon;
